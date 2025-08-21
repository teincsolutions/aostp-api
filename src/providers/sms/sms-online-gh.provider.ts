import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SmsProvider,
  SmsResponse,
} from '../../interfaces/sms-provider.interface';
import axios, { AxiosInstance } from 'axios';

interface SmsOnlineGHResponse {
  handshake: {
    id: number;
    label: string;
  };
  data?: {
    batch: string;
    category: number;
    delivery: boolean;
    destinations: Array<{
      id: string;
      to: string;
      status: {
        id: number;
        label: string;
      };
    }>;
  };
}

@Injectable()
export class SmsOnlineGHProvider implements SmsProvider {
  private readonly logger = new Logger(SmsOnlineGHProvider.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly apiKey: string;
  private readonly senderName: string;
  private readonly baseUrl: string;
  private readonly useHttps: boolean;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('SMS_ONLINE_GH_API_KEY', '');
    this.senderName = this.configService.get<string>(
      'SMS_ONLINE_GH_SENDER_NAME',
      'AOSTP',
    );
    this.useHttps = this.configService.get<boolean>(
      'SMS_ONLINE_GH_USE_HTTPS',
      true,
    );

    // Determine base URL based on HTTPS preference
    const protocol = this.useHttps ? 'https' : 'http';
    this.baseUrl = `${protocol}://api.smsonlinegh.com/v5`;

    // Initialize axios instance with default configuration
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 seconds timeout
      headers: {
        Host: 'api.smsonlinegh.com',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (!this.apiKey) {
      this.logger.warn(
        'SMS Online GH API key not configured. SMS sending will fail.',
      );
    }
  }

  async sendSms(phone: string, message: string): Promise<SmsResponse> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'SMS Online GH API key not configured',
        };
      }

      if (!this.senderName) {
        return {
          success: false,
          error: 'SMS Online GH sender name not configured',
        };
      }

      // Format phone number - SMS Online GH expects international format
      const formattedPhone = this.formatPhoneNumber(phone);

      // Prepare request data
      const requestData = {
        text: message,
        type: 0, // 0 for GSM default encoding
        sender: this.senderName,
        destinations: [formattedPhone],
      };

      // Make API request
      const response = await this.axiosInstance.post<SmsOnlineGHResponse>(
        '/message/sms/send',
        requestData,
        {
          headers: {
            Authorization: `key ${this.apiKey}`,
          },
        },
      );

      // Check response status
      if (
        response.data.handshake.id === 0 &&
        response.data.handshake.label === 'HSHK_OK'
      ) {
        // Extract message ID from the first destination
        const messageId =
          response.data.data?.destinations[0]?.id || response.data.data?.batch;

        this.logger.log(
          `SMS sent successfully via SMS Online GH to ${formattedPhone}: ${messageId}`,
        );

        return {
          success: true,
          messageId: messageId || undefined,
        };
      } else {
        // Handle API error response
        const errorMessage = `SMS Online GH API error: ${response.data.handshake.label}`;
        this.logger.error(errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error) {
      // Handle network or other errors
      let errorMessage = 'Unknown SMS Online GH error';

      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          errorMessage = `SMS Online GH API error: ${error.response.status} - ${error.response.statusText}`;
          this.logger.error(
            `SMS Online GH API error response:`,
            error.response.data,
          );
        } else if (error.request) {
          // The request was made but no response was received
          errorMessage = 'No response from SMS Online GH API';
        } else {
          // Something happened in setting up the request
          errorMessage = error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.logger.error(
        `Failed to send SMS via SMS Online GH to ${phone}:`,
        errorMessage,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Format phone number to international format expected by SMS Online GH
   * @param phone - Phone number in various formats
   * @returns Formatted phone number in international format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If the number starts with 0, assume it's a Ghana local number
    if (cleaned.startsWith('0')) {
      cleaned = '233' + cleaned.substring(1);
    }

    // If the number doesn't start with a country code, assume Ghana
    if (cleaned.length === 9) {
      cleaned = '233' + cleaned;
    }

    // Ensure the number starts with country code
    if (!cleaned.startsWith('233') && cleaned.length === 10) {
      // Assume it's a Ghana number without country code
      cleaned = '233' + cleaned;
    }

    return cleaned;
  }

  getName(): string {
    return 'SMS Online GH';
  }

  /**
   * Check account balance (optional utility method)
   */
  async checkBalance(): Promise<{
    success: boolean;
    balance?: number;
    error?: string;
  }> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'SMS Online GH API key not configured',
        };
      }

      const response = await this.axiosInstance.post(
        '/account/balance',
        {},
        {
          headers: {
            Authorization: `key ${this.apiKey}`,
          },
        },
      );

      if (
        response.data.handshake.id === 0 &&
        response.data.handshake.label === 'HSHK_OK'
      ) {
        return {
          success: true,
          balance: response.data.data?.balance,
        };
      } else {
        return {
          success: false,
          error: `Balance check failed: ${response.data.handshake.label}`,
        };
      }
    } catch (error) {
      let errorMessage = 'Failed to check balance';

      if (axios.isAxiosError(error) && error.response) {
        errorMessage = `Balance check error: ${error.response.status}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.logger.error('Failed to check SMS Online GH balance:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send bulk SMS to multiple recipients (optional utility method)
   */
  async sendBulkSms(
    phones: string[],
    message: string,
  ): Promise<{
    success: boolean;
    batchId?: string;
    results?: Array<{ phone: string; messageId?: string; error?: string }>;
    error?: string;
  }> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'SMS Online GH API key not configured',
        };
      }

      if (!this.senderName) {
        return {
          success: false,
          error: 'SMS Online GH sender name not configured',
        };
      }

      // Format all phone numbers
      const formattedPhones = phones.map((phone) =>
        this.formatPhoneNumber(phone),
      );

      // Prepare request data
      const requestData = {
        text: message,
        type: 0, // 0 for GSM default encoding
        sender: this.senderName,
        destinations: formattedPhones,
      };

      // Make API request
      const response = await this.axiosInstance.post<SmsOnlineGHResponse>(
        '/message/sms/send',
        requestData,
        {
          headers: {
            Authorization: `key ${this.apiKey}`,
          },
        },
      );

      // Check response status
      if (
        response.data.handshake.id === 0 &&
        response.data.handshake.label === 'HSHK_OK'
      ) {
        const batchId = response.data.data?.batch;
        const results =
          response.data.data?.destinations.map((dest) => ({
            phone: dest.to,
            messageId: dest.id,
            error: dest.status.id === 2105 ? undefined : dest.status.label,
          })) || [];

        this.logger.log(
          `Bulk SMS sent successfully via SMS Online GH. Batch ID: ${batchId}`,
        );

        return {
          success: true,
          batchId,
          results,
        };
      } else {
        return {
          success: false,
          error: `Bulk SMS failed: ${response.data.handshake.label}`,
        };
      }
    } catch (error) {
      let errorMessage = 'Failed to send bulk SMS';

      if (axios.isAxiosError(error) && error.response) {
        errorMessage = `Bulk SMS error: ${error.response.status}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.logger.error(
        'Failed to send bulk SMS via SMS Online GH:',
        errorMessage,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
