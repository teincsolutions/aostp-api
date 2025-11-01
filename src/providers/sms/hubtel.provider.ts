import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  SmsProvider,
  SmsResponse,
} from '../../interfaces/sms-provider.interface';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

export interface HubtelSmsResponse extends SmsResponse {
  rate?: number;
  networkId?: string;
  clientReference?: string;
  statusDescription?: string;
}

export interface BatchSmsResponse {
  batchId: string;
  status: number;
  data: Array<{
    recipient: string;
    content: string;
    messageId: string;
  }>;
}

export interface PersonalizedRecipient {
  To: string;
  Content: string;
}

@Injectable()
export class HubtelSmsProvider implements SmsProvider {
  private readonly logger = new Logger(HubtelSmsProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly isConfigured: boolean;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.clientId = this.configService.get<string>('HUBTEL_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>(
      'HUBTEL_CLIENT_SECRET',
      '',
    );
    this.baseUrl = this.configService.get<string>(
      'HUBTEL_SMS_BASE_URL',
      'https://sms.hubtel.com/v1',
    );

    this.isConfigured = !!(this.clientId && this.clientSecret);

    if (!this.isConfigured) {
      this.logger.warn(
        'Hubtel SMS provider is not configured. Please set HUBTEL_CLIENT_ID and HUBTEL_CLIENT_SECRET in environment variables.',
      );
    } else {
      this.logger.log('Hubtel SMS provider initialized');
    }
  }

  getName(): string {
    return 'Hubtel';
  }

  async sendSms(phone: string, message: string): Promise<SmsResponse> {
    if (!this.isConfigured) {
      this.logger.error('Hubtel SMS provider is not configured');
      return {
        success: false,
        error: 'Hubtel SMS provider is not configured',
      };
    }

    try {
      // Format phone number for Ghana (ensure it starts with country code)
      const formattedPhone = this.formatPhoneNumber(phone);

      this.logger.debug(`Sending SMS via Hubtel to ${formattedPhone}`);

      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/messages/send`,
          {
            From: this.configService.get<string>('HUBTEL_SENDER_ID', 'Hubtel'),
            To: formattedPhone,
            Content: message,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${Buffer.from(
                `${this.clientId}:${this.clientSecret}`,
              ).toString('base64')}`,
            },
          },
        ),
      );

      if (response.data && response.data.status === 0) {
        this.logger.debug('Hubtel SMS sent successfully', response.data);
        return {
          success: true,
          messageId: response.data.messageId,
        };
      } else {
        const errorMessage =
          response.data?.statusDescription || 'Unknown error from Hubtel';
        this.logger.error(`Hubtel SMS failed: ${errorMessage}`);
        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error) {
      this.logger.error('Error sending SMS via Hubtel:', error);

      let errorMessage = 'Failed to send SMS via Hubtel';
      if (error.response) {
        errorMessage =
          error.response.data?.statusDescription ||
          error.response.data?.message ||
          error.response.statusText ||
          errorMessage;
        this.logger.error('Hubtel API error response:', error.response.data);
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send SMS using GET method (alternative implementation)
   */
  async sendSmsGet(phone: string, message: string): Promise<SmsResponse> {
    if (!this.isConfigured) {
      this.logger.error('Hubtel SMS provider is not configured');
      return {
        success: false,
        error: 'Hubtel SMS provider is not configured',
      };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      const senderId = this.configService.get<string>(
        'HUBTEL_SENDER_ID',
        'Hubtel',
      );

      this.logger.debug(`Sending SMS via Hubtel GET to ${formattedPhone}`);

      const params = new URLSearchParams({
        clientsecret: this.clientSecret,
        clientid: this.clientId,
        from: senderId,
        to: formattedPhone,
        content: message,
      });

      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/messages/send?${params.toString()}`,
        ),
      );

      if (response.data && response.data.status === 0) {
        this.logger.debug(
          'Hubtel SMS sent successfully via GET',
          response.data,
        );
        return {
          success: true,
          messageId: response.data.messageId,
        };
      } else {
        const errorMessage =
          response.data?.statusDescription || 'Unknown error from Hubtel';
        this.logger.error(`Hubtel SMS failed: ${errorMessage}`);
        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error) {
      this.logger.error('Error sending SMS via Hubtel GET:', error);

      let errorMessage = 'Failed to send SMS via Hubtel';
      if (error.response) {
        errorMessage =
          error.response.data?.statusDescription ||
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
   * Send batch simple SMS to multiple recipients
   */
  async sendBatchSms(
    phones: string[],
    message: string,
    senderId?: string,
  ): Promise<{ success: boolean; batchId?: string; error?: string }> {
    if (!this.isConfigured) {
      this.logger.error('Hubtel SMS provider is not configured');
      return {
        success: false,
        error: 'Hubtel SMS provider is not configured',
      };
    }

    try {
      const formattedPhones = phones.map((phone) =>
        this.formatPhoneNumber(phone),
      );
      const from =
        senderId ||
        this.configService.get<string>('HUBTEL_SENDER_ID', 'Hubtel');

      this.logger.debug(
        `Sending batch SMS via Hubtel to ${formattedPhones.length} recipients`,
      );

      const response: AxiosResponse<BatchSmsResponse> = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/messages/batch/simple/send`,
          {
            From: from,
            Recipients: formattedPhones,
            Content: message,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${Buffer.from(
                `${this.clientId}:${this.clientSecret}`,
              ).toString('base64')}`,
            },
          },
        ),
      );

      if (response.data && response.data.status === 0) {
        this.logger.debug(
          `Hubtel batch SMS sent successfully. Batch ID: ${response.data.batchId}`,
        );
        return {
          success: true,
          batchId: response.data.batchId,
        };
      } else {
        const errorMessage = 'Batch SMS failed';
        this.logger.error(`Hubtel batch SMS failed: ${errorMessage}`);
        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error) {
      this.logger.error('Error sending batch SMS via Hubtel:', error);

      let errorMessage = 'Failed to send batch SMS via Hubtel';
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
   * Send batch personalized SMS to multiple recipients with different messages
   */
  async sendPersonalizedBatchSms(
    recipients: PersonalizedRecipient[],
    senderId?: string,
  ): Promise<{ success: boolean; batchId?: string; error?: string }> {
    if (!this.isConfigured) {
      this.logger.error('Hubtel SMS provider is not configured');
      return {
        success: false,
        error: 'Hubtel SMS provider is not configured',
      };
    }

    try {
      const formattedRecipients = recipients.map((recipient) => ({
        To: this.formatPhoneNumber(recipient.To),
        Content: recipient.Content,
      }));

      const from =
        senderId ||
        this.configService.get<string>('HUBTEL_SENDER_ID', 'Hubtel');

      this.logger.debug(
        `Sending personalized batch SMS via Hubtel to ${formattedRecipients.length} recipients`,
      );

      const response: AxiosResponse<BatchSmsResponse> = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/messages/batch/personalized/send`,
          {
            From: from,
            personalizedRecipients: formattedRecipients,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${Buffer.from(
                `${this.clientId}:${this.clientSecret}`,
              ).toString('base64')}`,
            },
          },
        ),
      );

      if (response.data && response.data.status === 0) {
        this.logger.debug(
          `Hubtel personalized batch SMS sent successfully. Batch ID: ${response.data.batchId}`,
        );
        return {
          success: true,
          batchId: response.data.batchId,
        };
      } else {
        const errorMessage = 'Personalized batch SMS failed';
        this.logger.error(
          `Hubtel personalized batch SMS failed: ${errorMessage}`,
        );
        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error) {
      this.logger.error(
        'Error sending personalized batch SMS via Hubtel:',
        error,
      );

      let errorMessage = 'Failed to send personalized batch SMS via Hubtel';
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
   * Check SMS status by message ID
   */
  async checkMessageStatus(messageId: string): Promise<{
    success: boolean;
    status?: string;
    data?: any;
    error?: string;
  }> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Hubtel SMS provider is not configured',
      };
    }

    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/messages/${messageId}`, {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${this.clientId}:${this.clientSecret}`,
            ).toString('base64')}`,
          },
        }),
      );

      if (response.data) {
        return {
          success: true,
          status: response.data.status,
          data: response.data,
        };
      } else {
        return {
          success: false,
          error: 'Message not found',
        };
      }
    } catch (error) {
      this.logger.error('Error checking message status via Hubtel:', error);
      return {
        success: false,
        error: 'Failed to check message status',
      };
    }
  }

  /**
   * Check SMS status by batch ID
   */
  async checkBatchStatus(batchId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Hubtel SMS provider is not configured',
      };
    }

    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/messages/batch/${batchId}`, {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${this.clientId}:${this.clientSecret}`,
            ).toString('base64')}`,
          },
        }),
      );

      if (response.data) {
        return {
          success: true,
          data: response.data,
        };
      } else {
        return {
          success: false,
          error: 'Batch not found',
        };
      }
    } catch (error) {
      this.logger.error('Error checking batch status via Hubtel:', error);
      return {
        success: false,
        error: 'Failed to check batch status',
      };
    }
  }

  /**
   * Format phone number to international format
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
   * Get client ID
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * Get sender ID
   */
  getSenderId(): string {
    return this.configService.get<string>('HUBTEL_SENDER_ID', 'Hubtel');
  }
}
