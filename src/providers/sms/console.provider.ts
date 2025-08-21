import { Injectable, Logger } from '@nestjs/common';
import {
  SmsProvider,
  SmsResponse,
} from '../../interfaces/sms-provider.interface';

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  sendSms(phone: string, message: string): Promise<SmsResponse> {
    // Log the SMS to console for development/testing
    this.logger.log(`[MOCK SMS] To: ${phone}`);
    this.logger.log(`[MOCK SMS] Message: ${message}`);
    this.logger.log(`[MOCK SMS] Timestamp: ${new Date().toISOString()}`);

    // Generate a mock message ID
    const mockMessageId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return Promise.resolve({
      success: true,
      messageId: mockMessageId,
    });
  }

  getName(): string {
    return 'Console (Mock)';
  }
}
