import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [HttpModule, ChatbotModule, ChatModule],
  controllers: [WhatsAppWebhookController],
  providers: [WhatsAppWebhookService],
})
export class WhatsAppWebhookModule {}
