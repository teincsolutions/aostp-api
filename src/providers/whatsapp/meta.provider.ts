import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  WhatsAppProvider,
  WhatsAppResponse,
  TemplateMessage,
} from '../../interfaces/whatsapp-provider.interface';

interface MetaTextRequest {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    body: string;
  };
}

interface MetaTemplateRequest {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: TemplateMessage;
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
  private readonly baseUrl = 'https://graph.facebook.com/v25.0';
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.accessToken =
      this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '';
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';

    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn(
        'Meta WhatsApp credentials not configured. Provider will not work properly.',
      );
    }
  }

  async sendMessage(phone: string, message: string): Promise<WhatsAppResponse> {
    try {
      this.ensureCredentials();
      const formattedPhone = this.formatPhoneNumber(phone);
      const payload: MetaTextRequest = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: message },
      };
      return this.postToMeta(payload, formattedPhone);
    } catch (error: any) {
      return this.handleError(phone, error);
    }
  }

  async sendTemplateMessage(
    phone: string,
    template: TemplateMessage,
  ): Promise<WhatsAppResponse> {
    try {
      this.ensureCredentials();
      const formattedPhone = this.formatPhoneNumber(phone);
      const payload: MetaTemplateRequest = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template,
      };
      return this.postToMeta(payload, formattedPhone);
    } catch (error: any) {
      return this.handleError(phone, error);
    }
  }

  getName(): string {
    return 'Meta WhatsApp Cloud API';
  }

  private async postToMeta(
    payload: MetaTextRequest | MetaTemplateRequest,
    formattedPhone: string,
  ): Promise<WhatsAppResponse> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
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
      return { success: true, messageId };
    }

    throw new Error('No message ID returned from Meta API');
  }

  private ensureCredentials(): void {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('Meta WhatsApp credentials not configured');
    }
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.length < 10) {
      throw new Error(`Invalid phone number format: ${phone}`);
    }
    return cleaned;
  }

  private handleError(phone: string, error: any): WhatsAppResponse {
    const status = error.response?.status;
    const data = error.response?.data;
    const url = error.config?.url;
    this.logger.error(
      `Failed to send WhatsApp message to ${phone} [${status}] ${url}: ${
        data ? JSON.stringify(data) : error.message
      }`,
    );
    return {
      success: false,
      error: data?.error?.message || error.message,
    };
  }
}
