import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class CallbackTokenService {
  private readonly logger = new Logger(CallbackTokenService.name);
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    // Use a separate secret for callback tokens
    this.secret = this.configService.get<string>(
      'CALLBACK_TOKEN_SECRET',
      this.configService.get<string>('JWT_SECRET', 'fallback-secret'),
    );

    // Shorter expiration for callback tokens
    this.expiresIn = this.configService.get<string>(
      'CALLBACK_TOKEN_EXPIRES_IN',
      '24h', // 24 hours
    );
  }

  /**
   * Generate a signed token for payment callback verification
   */
  generateCallbackToken(paymentData: {
    paymentId: string;
    paymentCode: string;
    paymentMethod: string;
    amount: number;
  }): string {
    const payload = {
      sub: 'callback-verification', // Subject identifier for callbacks
      paymentId: paymentData.paymentId,
      paymentCode: paymentData.paymentCode,
      paymentMethod: paymentData.paymentMethod,
      amount: paymentData.amount,
      iat: Math.floor(Date.now() / 1000), // Issued at time
    };

    try {
      const token = this.jwtService.sign(payload, {
        secret: this.secret,
        expiresIn: this.expiresIn,
      });

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
  verifyCallbackToken(token: string): {
    paymentId: string;
    paymentCode: string;
    paymentMethod: string;
    amount: number;
  } {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.secret,
      });

      // Validate payload structure
      if (
        !payload.paymentId ||
        !payload.paymentCode ||
        !payload.paymentMethod ||
        payload.amount === undefined
      ) {
        throw new Error('Invalid token payload structure');
      }

      this.logger.debug(
        `Verified callback token for payment ${payload.paymentCode}`,
      );
      return {
        paymentId: payload.paymentId,
        paymentCode: payload.paymentCode,
        paymentMethod: payload.paymentMethod,
        amount: payload.amount,
      };
    } catch (error) {
      this.logger.error(`Invalid callback token: ${error.message}`);
      throw new Error('Invalid or expired callback token');
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
    baseCallbackUrl?: string,
  ): string {
    const token = this.generateCallbackToken(paymentData);

    // Default to current API callback URL if not provided
    const baseUrl = baseCallbackUrl || this.getBaseCallbackUrl();

    // Add token as path parameter for security
    const callbackUrl = `${baseUrl}/${token}`;

    this.logger.debug(
      `Generated callback URL for payment ${paymentData.paymentCode}`,
    );
    return callbackUrl;
  }

  /**
   * Extract and verify token from callback URL
   */
  verifyCallbackFromUrl(urlPath: string): {
    paymentId: string;
    paymentCode: string;
    paymentMethod: string;
    amount: number;
  } {
    // Extract token from URL path (assuming format: /payments/callback/{token})
    const token = this.extractTokenFromPath(urlPath);

    if (!token) {
      throw new Error('No callback token found in URL');
    }

    return this.verifyCallbackToken(token);
  }

  /**
   * Extract token from URL path
   * Example: /api/v1/payments/callback/REDACTED_JWT...
   */
  private extractTokenFromPath(urlPath: string): string | null {
    // Remove query parameters and split by '/'
    const pathWithoutQuery = urlPath.split('?')[0];
    const pathParts = pathWithoutQuery.split('/');

    // Token should be the last part of the path
    const token = pathParts[pathParts.length - 1];

    // Basic validation - JWT tokens have 3 parts separated by dots
    if (token && token.split('.').length === 3) {
      return token;
    }

    return null;
  }

  /**
   * Get base callback URL from configuration
   */
  private getBaseCallbackUrl(): string {
    const baseUrl = this.configService.get<string>(
      'API_BASE_URL',
      'http://localhost:3000',
    );
    const apiPrefix = this.configService.get<string>('API_PREFIX', 'api/v1');

    return `${baseUrl}/${apiPrefix}/payments/callback`;
  }
}
