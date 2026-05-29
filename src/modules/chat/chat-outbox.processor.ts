import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ChatGateway } from './chat.gateway';

interface ChatOutboxJobData {
  messageId: string;
  to: string;
  type: string;
  text?: string;
  mediaUrl?: string;
  filename?: string;
}

@Processor('chat-outbox')
export class ChatOutboxProcessor {
  private readonly logger = new Logger(ChatOutboxProcessor.name);
  private readonly baseUrl = 'https://graph.facebook.com/v25.0';
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly chatGateway: ChatGateway,
  ) {
    this.accessToken =
      this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '';
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';
  }

  @Process('send-whatsapp')
  async handleSendWhatsApp(job: Job<ChatOutboxJobData>) {
    const { messageId, to, type, text, mediaUrl, filename } = job.data;

    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      this.logger.warn(`Message ${messageId} not found, skipping`);
      return;
    }

    try {
      const waResult = await this.sendToWhatsApp({
        to,
        type,
        text,
        mediaUrl,
        filename,
      });

      const content = (message.content as Record<string, unknown>) || {};
      delete content.retryCount;
      delete content.lastError;

      await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          status: 'sent',
          waMessageId: waResult.messageId,
          content: Object.keys(content).length > 0
            ? (content as Prisma.InputJsonValue)
            : undefined,
        },
      });

      this.chatGateway.notifyMessageStatus(messageId, 'sent', waResult.messageId);
      this.logger.log(`Message ${messageId} sent via WhatsApp`);
    } catch (error) {
      const content = (message.content as Record<string, unknown>) || {};
      const retryCount = ((content.retryCount as number) || 0) + 1;
      content.retryCount = retryCount;
      content.lastError = error.message;

      await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: { content: content as Prisma.InputJsonValue },
      });

      this.logger.warn(
        `Message ${messageId} failed (attempt ${retryCount}): ${error.message}`,
      );

      if (retryCount >= 3) {
        await this.prisma.chatMessage.update({
          where: { id: messageId },
          data: { status: 'failed' },
        });
        this.chatGateway.notifyMessageStatus(messageId, 'failed');
      } else {
        this.chatGateway.notifyMessageStatus(messageId, 'pending');
      }

      throw error;
    }
  }

  private async sendToWhatsApp(config: {
    to: string;
    type: string;
    text?: string;
    mediaUrl?: string;
    filename?: string;
  }): Promise<{ messageId?: string }> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const payload: any = {
      messaging_product: 'whatsapp',
      to: config.to,
      type: config.type,
    };

    switch (config.type) {
      case 'image':
        payload.image = { link: config.mediaUrl };
        if (config.text) payload.image.caption = config.text;
        break;
      case 'document':
        payload.document = {
          link: config.mediaUrl,
          filename: config.filename || 'document',
        };
        if (config.text) payload.document.caption = config.text;
        break;
      case 'audio':
        payload.audio = { link: config.mediaUrl };
        break;
      case 'video':
        payload.video = { link: config.mediaUrl };
        if (config.text) payload.video.caption = config.text;
        break;
      case 'text':
      default:
        payload.text = { body: config.text || '' };
        break;
    }

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const response = await firstValueFrom(
      this.httpService.post(url, payload, { headers }),
    );

    return {
      messageId: response.data?.messages?.[0]?.id,
    };
  }
}
