import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  SmsProvider,
  SmsResponse,
} from '../../interfaces/sms-provider.interface';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class ArkeselSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ArkeselSmsProvider.name);
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly baseUrl = 'https://sms.arkesel.com/api/v2';
  private readonly isConfigured: boolean;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('ARKESEL_API_KEY', '');
    this.senderId = this.configService.get<string>(
      'ARKESEL_SENDER_ID',
      'WillFind8',
    );

    this.isConfigured = !!this.apiKey;

    if (!this.isConfigured) {
      this.logger.warn(
        'Arkesel SMS provider is not configured. Please set ARKESEL_API_KEY in environment variables.',
      );
    } else {
      this.logger.log(
        `Arkesel SMS provider initialized with sender ID: ${this.senderId}`,
      );
    }
  }

  getName(): string {
    return 'Arkesel';
  }

  async sendSms(phone: string, message: string): Promise<SmsResponse> {
    if (!this.isConfigured) {
      this.logger.error('Arkesel SMS provider is not configured');
      return {
        success: false,
        error: 'Arkesel SMS provider is not configured',
      };
    }

    try {
      // Format phone number for Ghana (ensure it starts with 233)
      const formattedPhone = this.formatPhoneNumber(phone);

      this.logger.debug(`Sending SMS via Arkesel to ${formattedPhone}`);

      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/sms/send`,
          {
            sender: this.senderId,
            recipients: [formattedPhone],
            message: message,
            // Optional: Add scheduling, callback URL, etc.
            // schedule: '2025-01-14 10:00:00', // For scheduled messages
            // callback_url: 'https://your-domain.com/sms-callback',
          },
          {
            headers: {
              'api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (response.data && response.data.status === 'success') {
        this.logger.debug(
          `Arkesel SMS sent successfully. Response:`,
          response.data,
        );
        // Log additional details for debugging
        if (response.data.data?.balance) {
          this.logger.debug(`Balance: ${response.data.data.balance}`);
        }
        if (response.data.data?.cost) {
          this.logger.debug(`Cost: ${response.data.data.cost}`);
        }
        return {
          success: true,
          messageId: response.data.data?.message_id || response.data.message_id,
        };
      } else {
        const errorMessage =
          response.data?.message || 'Unknown error from Arkesel';
        this.logger.error(`Arkesel SMS failed: ${errorMessage}`);
        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error) {
      this.logger.error('Error sending SMS via Arkesel:', error);

      let errorMessage = 'Failed to send SMS via Arkesel';
      if (error.response) {
        errorMessage =
          error.response.data?.message ||
          error.response.statusText ||
          errorMessage;
        this.logger.error('Arkesel API error response:', error.response.data);
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send bulk SMS to multiple recipients
   */
  async sendBulkSms(phones: string[], message: string): Promise<SmsResponse> {
    if (!this.isConfigured) {
      this.logger.error('Arkesel SMS provider is not configured');
      return {
        success: false,
        error: 'Arkesel SMS provider is not configured',
      };
    }

    try {
      // Format all phone numbers
      const formattedPhones = phones.map((phone) =>
        this.formatPhoneNumber(phone),
      );

      this.logger.debug(
        `Sending bulk SMS via Arkesel to ${formattedPhones.length} recipients`,
      );

      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/sms/send`,
          {
            sender: this.senderId,
            recipients: formattedPhones,
            message: message,
          },
          {
            headers: {
              'api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (response.data && response.data.status === 'success') {
        this.logger.debug(
          `Arkesel bulk SMS sent successfully to ${formattedPhones.length} recipients`,
        );
        // Log additional details for debugging
        if (response.data.data?.balance) {
          this.logger.debug(`Balance: ${response.data.data.balance}`);
        }
        if (response.data.data?.total_cost) {
          this.logger.debug(`Total cost: ${response.data.data.total_cost}`);
        }
        return {
          success: true,
          messageId: response.data.data?.message_id || response.data.message_id,
        };
      } else {
        const errorMessage = response.data?.message || 'Bulk SMS failed';
        this.logger.error(`Arkesel bulk SMS failed: ${errorMessage}`);
        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error) {
      this.logger.error('Error sending bulk SMS via Arkesel:', error);

      let errorMessage = 'Failed to send bulk SMS via Arkesel';
      if (error.response) {
        errorMessage =
          error.response.data?.message ||
          error.response.statusText ||
          errorMessage;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check SMS balance
   */
  async checkBalance(): Promise<{
    success: boolean;
    balance?: number;
    error?: string;
  }> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Arkesel SMS provider is not configured',
      };
    }

    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/account/balance`, {
          headers: {
            'api-key': this.apiKey,
          },
        }),
      );

      if (response.data && response.data.status === 'success') {
        return {
          success: true,
          balance: response.data.data?.balance || response.data.balance,
        };
      } else {
        return {
          success: false,
          error: response.data?.message || 'Failed to check balance',
        };
      }
    } catch (error) {
      this.logger.error('Error checking Arkesel balance:', error);
      return {
        success: false,
        error: 'Failed to check balance',
      };
    }
  }

  /**
   * Format phone number to Ghana international format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    // Handle different formats
    if (cleaned.startsWith('233')) {
      // Already in international format
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      // Local format (e.g., 0244123456)
      return '233' + cleaned.substring(1);
    } else if (cleaned.length === 9) {
      // Without country code or leading zero (e.g., 244123456)
      return '233' + cleaned;
    } else if (cleaned.startsWith('+233')) {
      // With plus sign
      return cleaned.substring(1);
    }

    // Default: assume it's already properly formatted
    return cleaned;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phone: string): boolean {
    const formatted = this.formatPhoneNumber(phone);
    // Ghana phone numbers should be 12 digits (233 + 9 digits)
    return /^233\d{9}$/.test(formatted);
  }

  /**
   * Get provider configuration status
   */
  isProviderConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Get sender ID
   */
  getSenderId(): string {
    return this.senderId;
  }
}
