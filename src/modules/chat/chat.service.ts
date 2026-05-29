import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ChatGateway } from './chat.gateway';
import { S3Service } from '../../providers/storage/s3.service';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { Prisma } from '@prisma/client';

export interface SaveMessageData {
  conversationId: string;
  fromNumber: string;
  toNumber: string;
  direction: 'INBOUND' | 'OUTBOUND';
  messageType?: string;
  content?: any;
  text?: string;
  status?: string;
  waMessageId?: string;
  repliedById?: string;
}

export interface ConversationResult {
  conversationId: string;
  phoneNumber: string;
  customerName: string | null;
  customerCode: string | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  lastDirection: string | null;
  unreadCount: number;
}

export interface PaginatedMessages {
  messages: Array<{
    id: string;
    direction: string;
    messageType: string;
    text: string | null;
    status: string;
    waMessageId: string | null;
    readAt: Date | null;
    createdAt: Date;
    repliedBy: { id: string; firstName: string; lastName: string } | null;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedConversations {
  conversations: ConversationResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v25.0';
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly chatGateway: ChatGateway,
    private readonly s3Service: S3Service,
  ) {
    this.accessToken =
      this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '';
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';
  }

  async saveMessage(data: SaveMessageData): Promise<any> {
    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId: data.conversationId,
        fromNumber: data.fromNumber,
        toNumber: data.toNumber,
        direction: data.direction,
        messageType: data.messageType || 'text',
        content: data.content ?? Prisma.JsonNull,
        text: data.text,
        status: data.status || 'sent',
        waMessageId: data.waMessageId,
        repliedById: data.repliedById,
      },
      include: {
        repliedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    this.logger.debug(
      `Saved ${data.direction} message for conversation ${data.conversationId}`,
    );

    const repliedByUser = data.repliedById
      ? await this.prisma.user.findUnique({
          where: { id: data.repliedById },
          select: { id: true, firstName: true, lastName: true },
        })
      : null;

    this.chatGateway.notifyNewMessage({
      id: message.id,
      conversationId: message.conversationId,
      fromNumber: message.fromNumber,
      toNumber: message.toNumber,
      direction: message.direction as 'INBOUND' | 'OUTBOUND',
      text: message.text,
      content: message.content,
      messageType: message.messageType,
      status: message.status,
      createdAt: message.createdAt,
      repliedBy: repliedByUser,
    });

    const totalUnread = await this.getUnreadCount();
    this.chatGateway.notifyUnreadCount(totalUnread);

    return message;
  }

  async getConversations(
    query: ConversationQueryDto,
  ): Promise<PaginatedConversations> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const conversations = await this.prisma.chatMessage.groupBy({
      by: ['conversationId'],
      _count: { id: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      skip,
      take: limit,
    });

    const total = conversations.length;

    const enriched = await Promise.all(
      conversations.map(async (c) => {
        const lastMsg = await this.prisma.chatMessage.findFirst({
          where: { conversationId: c.conversationId },
          orderBy: { createdAt: 'desc' },
          select: { text: true, createdAt: true, direction: true },
        });

        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            conversationId: c.conversationId,
            direction: 'INBOUND',
            readAt: null,
          },
        });

        const customer = await this.prisma.customer.findFirst({
          where: {
            OR: [
              { phoneNumber: { endsWith: c.conversationId.slice(-9) } },
              { alternatePhone: { endsWith: c.conversationId.slice(-9) } },
            ],
          },
          select: {
            firstName: true,
            lastName: true,
            customerCode: true,
          },
        });

        const customerName =
          customer && customer.firstName
            ? `${customer.firstName}${customer.lastName ? ` ${customer.lastName}` : ''}`
            : null;

        return {
          conversationId: c.conversationId,
          phoneNumber: c.conversationId,
          customerName,
          customerCode: customer?.customerCode || null,
          lastMessage: lastMsg?.text || null,
          lastMessageAt: lastMsg?.createdAt || null,
          lastDirection: lastMsg?.direction || null,
          unreadCount,
        };
      }),
    );

    const totalCount = await this.getConversationCount();
    return {
      conversations: enriched,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async getConversationMessages(
    conversationId: string,
    query: MessagesQueryDto,
  ): Promise<PaginatedMessages> {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where = { conversationId };

    const [messages, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          repliedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.chatMessage.count({ where }),
    ]);

    await this.prisma.chatMessage.updateMany({
      where: {
        conversationId,
        direction: 'INBOUND',
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return {
      messages: messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        messageType: m.messageType,
        text: m.text,
        content: m.content,
        status: m.status,
        waMessageId: m.waMessageId,
        readAt: m.readAt,
        createdAt: m.createdAt,
        repliedBy: m.repliedBy,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async sendAdminReply(dto: SendMessageDto, userId: string): Promise<any> {
    const conversationId = this.normalizePhone(dto.to);
    const messageType = dto.type || 'text';

    let waMessageId: string | undefined;

    if (this.accessToken && this.phoneNumberId) {
      try {
        const result = await this.sendToWhatsApp({
          to: dto.to,
          type: messageType,
          text: dto.text,
          mediaUrl: dto.mediaUrl,
          filename: dto.filename,
        });
        waMessageId = result.messageId;
      } catch (error) {
        this.logger.error(
          `Failed to send WhatsApp message to ${dto.to}: ${error.message}`,
        );
      }
    } else {
      this.logger.warn(
        'WhatsApp credentials not configured. Skipping actual send.',
      );
    }

    const content: any = {};
    if (dto.mediaUrl) content.mediaUrl = dto.mediaUrl;
    if (dto.filename) content.filename = dto.filename;
    if (dto.key) content.key = dto.key;
    if (dto.bucket) content.bucket = dto.bucket;

    const message = await this.saveMessage({
      conversationId,
      fromNumber: this.phoneNumberId || 'business',
      toNumber: dto.to,
      direction: 'OUTBOUND',
      messageType,
      text: dto.text,
      content: Object.keys(content).length > 0 ? content : undefined,
      status: waMessageId ? 'sent' : 'failed',
      waMessageId,
      repliedById: userId,
    });

    return message;
  }

  async markConversationRead(conversationId: string): Promise<void> {
    await this.prisma.chatMessage.updateMany({
      where: {
        conversationId,
        direction: 'INBOUND',
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  async getUnreadCount(): Promise<number> {
    return this.prisma.chatMessage.count({
      where: {
        direction: 'INBOUND',
        readAt: null,
      },
    });
  }

  async getSignedMediaUrls(
    items: { key: string; bucket?: string }[],
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const item of items) {
      try {
        const url = await this.s3Service.generatePresignedDownloadUrl(
          item.key,
          3600,
          item.bucket,
        );
        result[item.key] = url;
      } catch (error) {
        this.logger.error(
          `Failed to generate signed URL for key ${item.key}`,
          error,
        );
      }
    }
    return result;
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

  private async getConversationCount(): Promise<number> {
    const result = await this.prisma.chatMessage.groupBy({
      by: ['conversationId'],
      _count: { conversationId: true },
    });
    return result.length;
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) return '233' + digits.slice(1);
    if (digits.startsWith('233')) return digits;
    return digits;
  }
}
