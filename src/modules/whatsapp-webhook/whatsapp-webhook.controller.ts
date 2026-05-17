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
import { MetaWhatsAppProvider } from '../../providers/whatsapp/meta.provider';

@Controller('webhook/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly whatsAppWebhookService: WhatsAppWebhookService,
    private readonly metaWhatsAppProvider: MetaWhatsAppProvider,
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
  @Get('test/send-template')
  async testSendTemplate(
    @Query('phone') phone: string,
    @Query('template') template: string = 'package_received',
  ): Promise<any> {
    this.logger.warn(`[TEST] Sending template "${template}" to ${phone}`);

    if (!phone) {
      return { success: false, error: 'phone query param is required' };
    }

    const result = await this.metaWhatsAppProvider.sendTemplateMessage(phone, {
      name: template,
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Test' },
            { type: 'text', text: 'China Main' },
            { type: 'text', text: 'AOSTP-123' },
            { type: 'text', text: 'Test package' },
          ],
        },
      ],
    });

    this.logger.warn(`[TEST] Result for ${phone}: ${JSON.stringify(result)}`);

    return result;
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
