import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import * as crypto from 'crypto';
import { response } from 'express';

@Injectable()
export class CallbackTokenService {
  private readonly logger = new Logger(CallbackTokenService.name);
  private readonly secret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Use a separate secret for callback tokens
    this.secret = this.configService.get<string>(
      'CALLBACK_TOKEN_SECRET',
      this.configService.get<string>('JWT_SECRET', 'fallback-secret'),
    );
  }

  /**
   * Generate a signed token for payment callback verification
   */
  generateCallbackToken(paymentData: { paymentCode: string }): string {
    const payload: any = {
      paymentCode: paymentData.paymentCode,
      iat: Math.floor(Date.now() / 1000), // Issued at time
    };

    try {
      const payloadStr = JSON.stringify(payload);
      const payloadB64 = Buffer.from(payloadStr).toString('base64url');
      const signature = crypto
        .createHmac('sha256', this.secret)
        .update(payloadB64)
        .digest('base64url');

      const token = `${payloadB64}.${signature}`;

      this.logger.debug(
        `Generated callback token for payment ${paymentData.paymentCode}`,
      );
      return token;
    } catch (error) {
      this.logger.error(`Failed to generate callback token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify a callback token
   */
  async verifyCallbackToken(token: string): Promise<{
    paymentCode: string;
    paymentId: string;
    paymentMethod: string;
    amount: number;
  }> {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) {
        throw new Error('Invalid token format');
      }

      const [payloadB64, signature] = parts;
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(payloadB64)
        .digest('base64url');

      if (signature !== expectedSignature) {
        throw new Error('Invalid signature');
      }

      const payloadStr = Buffer.from(payloadB64, 'base64url').toString();
      const payload = JSON.parse(payloadStr);

      // Validate minimum required fields
      if (!payload.paymentCode) {
        throw new Error('Invalid token payload structure', payload);
      }

      this.logger.debug(
        `Verified callback token for payment ${payload.paymentCode}`,
      );

      // Otherwise, lookup payment from database
      const payment = await this.findPaymentByCode(payload.paymentCode);
      if (!payment) {
        throw new Error('Payment not found');
      }

      this.logger.debug(
        `Callback token corresponds to payment method ${payment.paymentMethod}`,
      );

      return {
        paymentId: payment.id,
        paymentCode: payment.paymentCode,
        paymentMethod: payment.paymentMethod,
        amount: payment.amount,
      };
    } catch (error) {
      this.logger.error(`Invalid callback token: ${error.message}`);
      throw new Error('Invalid or expired callback token', error);
    }
  }

  /**
   * Generate callback URL with signed token
   */
  generateCallbackUrl(
    paymentData: {
      paymentId: string;
      paymentCode: string;
      paymentMethod: string;
      amount: number;
    },
    baseCallbackUrl: string,
  ): string {
    const token = this.generateCallbackToken(paymentData);
    // Add token as path parameter for security
    const callbackUrl = `${baseCallbackUrl}/${token}`;

    this.logger.debug(
      `Generated callback URL for payment ${paymentData.paymentCode}`,
    );
    return callbackUrl;
  }

  private async findPaymentByCode(paymentCode: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { paymentCode },
    });

    return payment;
  }
}
