import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  WhatsAppProvider,
  WhatsAppResponse,
} from '../../interfaces/whatsapp-provider.interface';

interface MetaWhatsAppMessageRequest {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    body: string;
  };
}

interface MetaWhatsAppMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

@Injectable()
export class MetaWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(MetaWhatsAppProvider.name);
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.accessToken =
      this.configService.get<string>('META_WHATSAPP_ACCESS_TOKEN') || '';
    this.phoneNumberId =
      this.configService.get<string>('META_WHATSAPP_PHONE_NUMBER_ID') || '';

    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn(
        'Meta WhatsApp credentials not configured. Provider will not work properly.',
      );
    }
  }

  async sendMessage(phone: string, message: string): Promise<WhatsAppResponse> {
    try {
      if (!this.accessToken || !this.phoneNumberId) {
        throw new Error('Meta WhatsApp credentials not configured');
      }

      // Format phone number (remove + and ensure it's in international format)
      const formattedPhone = this.formatPhoneNumber(phone);

      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      const payload: MetaWhatsAppMessageRequest = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: {
          body: message,
        },
      };

      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      };

      this.logger.debug(`Sending WhatsApp message to ${formattedPhone}`);

      const response = await firstValueFrom(
        this.httpService.post<MetaWhatsAppMessageResponse>(url, payload, {
          headers,
        }),
      );

      if (response.data.messages && response.data.messages.length > 0) {
        const messageId = response.data.messages[0].id;
        this.logger.debug(
          `WhatsApp message sent successfully with ID: ${messageId}`,
        );
        return {
          success: true,
          messageId,
        };
      } else {
        throw new Error('No message ID returned from Meta API');
      }
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message to ${phone}:`,
        error.response?.data || error.message,
      );

      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  getName(): string {
    return 'Meta WhatsApp Cloud API';
  }

  private formatPhoneNumber(phone: string): string {
    // Remove any non-numeric characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If starts with +, remove it and ensure international format
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }

    // Ensure it starts with country code (basic validation)
    if (cleaned.length < 10) {
      throw new Error(`Invalid phone number format: ${phone}`);
    }

    return cleaned;
  }
}
