import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../shared/decorators/public.decorator';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

@Controller('webhook/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly whatsAppWebhookService: WhatsAppWebhookService,
  ) {}

  @Public()
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const verifyToken = this.configService.get<string>(
      'WHATSAPP_VERIFY_TOKEN',
      '',
    );

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully');
      return challenge;
    }

    this.logger.warn(
      `Webhook verification failed — mode: ${mode}, token mismatch: ${token !== verifyToken}`,
    );
    throw new HttpException('Verification failed', HttpStatus.FORBIDDEN);
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleIncoming(
    @Body() body: any,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature?: string,
  ): Promise<{ status: string }> {
    if (!this.verifySignature(signature, req.rawBody)) {
      throw new HttpException('Invalid webhook signature', HttpStatus.FORBIDDEN);
    }

    try {
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messages = value?.messages;

      if (!messages) {
        return { status: 'ok' };
      }

      const message = messages[0];
      const from = message.from as string;
      const messageId = message.id as string;

      await this.whatsAppWebhookService.markAsRead(messageId);

      switch (message?.type) {
        case 'text': {
          const text = message.text?.body as string;
          this.logger.debug(
            `Incoming WhatsApp text from ${from}: ${text?.substring(0, 100)}`,
          );
          await this.whatsAppWebhookService.handleTextMessage(from, text);
          break;
        }
        case 'interactive': {
          if (message.interactive?.type === 'list_reply') {
            const replyId = message.interactive.list_reply.id as string;
            this.logger.debug(
              `Incoming WhatsApp list reply from ${from}: ${replyId}`,
            );
            await this.whatsAppWebhookService.handleInteractiveReply(
              from,
              replyId,
              message,
            );
          }
          break;
        }
        default:
          this.logger.debug(`Ignoring message of type: ${message?.type}`);
      }

      return { status: 'ok' };
    } catch (error: any) {
      this.logger.error('Error processing incoming webhook:', error.message);
      return { status: 'ok' };
    }
  }

  private verifySignature(
    signature: string | undefined,
    rawBody: Buffer | undefined,
  ): boolean {
    const appSecret = this.configService.get<string>('WHATSAPP_APP_SECRET', '');

    if (!appSecret) {
      this.logger.error('WHATSAPP_APP_SECRET is not configured');
      return false;
    }

    if (!signature) {
      this.logger.warn('Missing x-hub-signature-256 header');
      return false;
    }

    if (!rawBody) {
      this.logger.error('Missing raw request body; cannot verify webhook signature');
      return false;
    }

    const incomingSignature = signature.startsWith('sha256=')
      ? signature.slice('sha256='.length)
      : signature;

    const expectedSignature = createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    try {
      const incomingBuffer = Buffer.from(incomingSignature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (incomingBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return timingSafeEqual(incomingBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }
}
