import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { WhatsAppModule } from '../../providers/whatsapp/whatsapp.module';

@Module({
  imports: [HttpModule, WhatsAppModule],
  controllers: [WhatsAppWebhookController],
  providers: [WhatsAppWebhookService],
})
export class WhatsAppWebhookModule {}
