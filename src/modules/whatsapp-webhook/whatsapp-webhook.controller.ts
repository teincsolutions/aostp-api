import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
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
  async handleIncoming(@Body() body: any): Promise<{ status: string }> {
    try {
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messages = value?.messages;

      if (!messages) {
        return { status: 'ok' };
      }

      const message = messages[0];

      if (message?.type !== 'text') {
        this.logger.debug(
          `Ignoring non-text message of type: ${message?.type}`,
        );
        return { status: 'ok' };
      }

      const from = message.from as string;
      const text = message.text?.body as string;

      this.logger.debug(
        `Incoming WhatsApp message from ${from}: ${text?.substring(0, 100)}`,
      );

      await this.whatsAppWebhookService.handleTextMessage(from, text);

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Error processing incoming webhook:', error.message);
      return { status: 'ok' };
    }
  }
}
