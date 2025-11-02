import { Injectable, Logger } from '@nestjs/common';
import {
  WhatsAppProvider,
  WhatsAppResponse,
} from '../../interfaces/whatsapp-provider.interface';

@Injectable()
export class ConsoleWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(ConsoleWhatsAppProvider.name);

  sendMessage(phone: string, message: string): Promise<WhatsAppResponse> {
    // Log the WhatsApp message to console for development/testing
    this.logger.log(`[MOCK WHATSAPP] To: ${phone}`);
    this.logger.log(`[MOCK WHATSAPP] Message: ${message}`);
    this.logger.log(`[MOCK WHATSAPP] Timestamp: ${new Date().toISOString()}`);

    // Generate a mock message ID
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
