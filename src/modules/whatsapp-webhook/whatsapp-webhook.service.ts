import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ChatbotService } from '../chatbot/services/chatbot.service';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v25.0';
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly chatbotService: ChatbotService,
    private readonly chatService: ChatService,
  ) {
    this.accessToken =
      this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '';
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';

    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn(
        'WhatsApp credentials not configured. Webhook will not be able to reply.',
      );
    }
  }

  async handleInteractiveReply(
    from: string,
    replyId: string,
    rawMessage?: any,
  ): Promise<void> {
    const conversationId = this.normalizePhone(from);

    const prompts: Record<string, string> = {
      TRACK:
        '🔍 Please send your tracking code, invoice number, or intake code and I will look it up.',
      PHONE:
        '📋 Please send your phone number so I can find your pending shipments.',
    };

    const prompt = prompts[replyId];

    await this.chatService.saveMessage({
      conversationId,
      fromNumber: from,
      toNumber: this.phoneNumberId || 'business',
      direction: 'INBOUND',
      messageType: 'interactive',
      text: `List reply: ${replyId}`,
      content: rawMessage?.interactive,
    });

    if (!prompt) {
      return;
    }

    const waId = await this.sendReply(from, prompt);
    await this.chatService.saveMessage({
      conversationId,
      fromNumber: this.phoneNumberId || 'business',
      toNumber: from,
      direction: 'OUTBOUND',
      text: prompt,
      waMessageId: waId,
    });
  }

  async handleTextMessage(from: string, text: string): Promise<void> {
    const conversationId = this.normalizePhone(from);

    await this.chatService.saveMessage({
      conversationId,
      fromNumber: from,
      toNumber: this.phoneNumberId || 'business',
      direction: 'INBOUND',
      text,
    });

    try {
      const response = await this.chatbotService.handleInput(from, text);

      if (response.type === 'menu') {
        const waId = await this.sendInteractiveList(from);
        await this.chatService.saveMessage({
          conversationId,
          fromNumber: this.phoneNumberId || 'business',
          toNumber: from,
          direction: 'OUTBOUND',
          messageType: 'interactive',
          text: 'Interactive menu sent',
          waMessageId: waId,
        });
      } else {
        const waId = await this.sendReply(from, response.text);
        await this.chatService.saveMessage({
          conversationId,
          fromNumber: this.phoneNumberId || 'business',
          toNumber: from,
          direction: 'OUTBOUND',
          text: response.text,
          waMessageId: waId,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle message from ${from}: ${error.message}`,
      );
      const errorText = 'Sorry, something went wrong. Please try again later.';
      const waId = await this.sendReply(from, errorText);
      await this.chatService.saveMessage({
        conversationId,
        fromNumber: this.phoneNumberId || 'business',
        toNumber: from,
        direction: 'OUTBOUND',
        text: errorText,
        waMessageId: waId,
      });
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    if (!this.accessToken || !this.phoneNumberId) return;

    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      await firstValueFrom(this.httpService.post(url, payload, { headers }));
    } catch (error) {
      this.logger.debug(
        `Failed to mark message ${messageId} as read:`,
        error.response?.data || error.message,
      );
    }
  }

  private async sendInteractiveList(to: string): Promise<string | undefined> {
    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn(
        `Cannot send reply to ${to}: WhatsApp credentials not configured`,
      );
      return undefined;
    }

    const companyName =
      this.configService.get<string>('COMPANY_NAME') || 'AOSTP Logistics';

    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: `${companyName} 🚚`,
        },
        body: {
          text: 'Welcome! How can we help you today?',
        },
        footer: {
          text: 'Select an option below',
        },
        action: {
          button: 'Menu',
          sections: [
            {
              title: 'Shipment',
              rows: [
                {
                  id: 'TRACK',
                  title: 'Track Package',
                  description: 'Look up by tracking code or invoice',
                },
                {
                  id: 'PHONE',
                  title: 'My Shipments',
                  description: 'View pending shipments by phone',
                },
              ],
            },
          ],
        },
      },
    };
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, { headers }),
      );
      const messageId = response.data?.messages?.[0]?.id;
      this.logger.debug(
        `Interactive list sent to ${to} — Message ID: ${messageId || 'unknown'}`,
      );
      return messageId;
    } catch (error) {
      this.logger.error(
        `Failed to send interactive list to ${to}:`,
        error.response?.data || error.message,
      );
      return undefined;
    }
  }

  private async sendReply(
    to: string,
    text: string,
  ): Promise<string | undefined> {
    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn(
        `Cannot send reply to ${to}: WhatsApp credentials not configured`,
      );
      return undefined;
    }

    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    };
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, { headers }),
      );
      const messageId = response.data?.messages?.[0]?.id;
      this.logger.debug(
        `Reply sent to ${to} — Message ID: ${messageId || 'unknown'}`,
      );
      return messageId;
    } catch (error) {
      this.logger.error(
        `Failed to send reply to ${to}:`,
        error.response?.data || error.message,
      );
      return undefined;
    }
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) return '233' + digits.slice(1);
    if (digits.startsWith('233')) return digits;
    return digits;
  }
}
