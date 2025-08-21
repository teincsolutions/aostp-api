import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { SmsProvider } from '../../interfaces/sms-provider.interface';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject('SMS_PROVIDER') private smsProvider: SmsProvider,
  ) {}

  async generateSecret(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate a secret key
    const secret = speakeasy.generateSecret({
      name: `${user.email} (AOSTP)`,
      issuer: this.configService.get('APP_NAME', 'AOSTP'),
      length: 32,
    });

    // Store the temporary secret (not yet verified)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret.base32,
        twoFactorEnabled: false, // Not enabled until verified
      },
    });

    // Generate QR code URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
      otpAuthUrl: secret.otpauth_url,
    };
  }

  async verifyAndEnable(userId: string, token: string, phoneNumber?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException(
        '2FA setup not found. Please restart the setup process.',
      );
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow for some time drift
    });

    if (!verified) {
      throw new BadRequestException('Invalid verification code');
    }

    // Enable 2FA and save phone number if provided
    const updateData: any = {
      twoFactorEnabled: true,
    };

    // Update phone number if provided for SMS backup
    if (phoneNumber) {
      // Find the customer record if exists to update phone
      const customer = await this.prisma.customer.findFirst({
        where: { email: user.email },
      });

      if (customer) {
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { phoneNumber },
        });
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return { message: '2FA has been enabled successfully' };
  }

  async verify(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    // First check if it's a valid TOTP token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (verified) {
      return true;
    }

    // If TOTP fails, check if it's a valid SMS backup code
    return this.verifyBackupCode(userId, token);
  }

  async disable(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Verify current token before disabling
    const isValid = await this.verify(userId, token);
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    // Disable 2FA and remove secret
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    // Clear any backup codes
    this.clearBackupCodes(userId);

    return { message: '2FA has been disabled successfully' };
  }

  async sendBackupCode(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    // Find customer phone number
    const customer = await this.prisma.customer.findFirst({
      where: { email: user.email },
    });

    if (!customer || !customer.phoneNumber) {
      throw new BadRequestException(
        'No phone number found for SMS backup codes',
      );
    }

    // Generate a 6-digit backup code
    const backupCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store backup code with expiration (valid for 5 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Store in database (you might want to create a dedicated table for this)
    await this.storeBackupCode(userId, backupCode, expiresAt);

    // Send SMS
    const message = `Your AOSTP backup verification code is: ${backupCode}. This code expires in 5 minutes.`;

    try {
      const result = await this.smsProvider.sendSms(
        customer.phoneNumber,
        message,
      );

      if (!result.success) {
        this.logger.error(`Failed to send backup code SMS: ${result.error}`);
        throw new BadRequestException('Failed to send backup code via SMS');
      }

      this.logger.log(
        `Backup code sent to ${customer.phoneNumber} for user ${user.email}`,
      );

      return { message: 'Backup verification code sent via SMS' };
    } catch (error) {
      this.logger.error(`SMS sending error: ${error.message}`);
      throw new BadRequestException('Failed to send backup code via SMS');
    }
  }

  private async storeBackupCode(userId: string, code: string, expiresAt: Date) {
    // For now, we'll store in a simple way. In production, you might want a dedicated table
    // We'll use the user's updatedAt field and store in a temporary way
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        // Store temporarily in a JSON field or create a separate table
        updatedAt: new Date(),
      },
    });

    // Store in memory cache or Redis in production
    // For now, we'll use a simple in-memory approach
    this.backupCodes.set(userId, { code, expiresAt });

    // Clean up expired codes after 10 minutes
    setTimeout(
      () => {
        this.backupCodes.delete(userId);
      },
      10 * 60 * 1000,
    );
  }

  private verifyBackupCode(userId: string, token: string): Promise<boolean> {
    const storedCode = this.backupCodes.get(userId);

    if (!storedCode) {
      return Promise.resolve(false);
    }

    const now = new Date();
    if (now > storedCode.expiresAt) {
      this.backupCodes.delete(userId);
      return Promise.resolve(false);
    }

    const isValid = storedCode.code === token;
    if (isValid) {
      // Code can only be used once
      this.backupCodes.delete(userId);
    }

    return Promise.resolve(isValid);
  }

  private clearBackupCodes(userId: string) {
    this.backupCodes.delete(userId);
  }

  // Simple in-memory storage for backup codes
  // In production, use Redis or a dedicated database table
  private backupCodes = new Map<string, { code: string; expiresAt: Date }>();
}
