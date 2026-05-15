import { Injectable, Logger } from '@nestjs/common';
import {
  WhatsAppProvider,
  WhatsAppResponse,
  TemplateMessage,
} from '../../interfaces/whatsapp-provider.interface';

@Injectable()
export class ConsoleWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(ConsoleWhatsAppProvider.name);

  sendMessage(phone: string, message: string): Promise<WhatsAppResponse> {
    this.logger.log(`[MOCK WHATSAPP] To: ${phone}`);
    this.logger.log(`[MOCK WHATSAPP] Message: ${message}`);
    this.logger.log(`[MOCK WHATSAPP] Timestamp: ${new Date().toISOString()}`);

    const mockMessageId = `mock_wa_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return Promise.resolve({
      success: true,
      messageId: mockMessageId,
    });
  }

  sendTemplateMessage(
    phone: string,
    template: TemplateMessage,
  ): Promise<WhatsAppResponse> {
    this.logger.log(`[MOCK WHATSAPP] To: ${phone}`);
    this.logger.log(`[MOCK WHATSAPP] Template: ${template.name}`);
    this.logger.log(`[MOCK WHATSAPP] Language: ${template.language.code}`);
    this.logger.log(
      `[MOCK WHATSAPP] Components: ${JSON.stringify(template.components)}`,
    );
    this.logger.log(`[MOCK WHATSAPP] Timestamp: ${new Date().toISOString()}`);

    const mockMessageId = `mock_wa_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return Promise.resolve({
      success: true,
      messageId: mockMessageId,
    });
  }

  getName(): string {
    return 'WhatsApp Console (Mock)';
  }
}
