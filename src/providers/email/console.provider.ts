import { Injectable, Logger } from '@nestjs/common';
import {
  EmailProvider,
  EmailResponse,
  EmailOptions,
} from '../../interfaces/email-provider.interface';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  getName(): string {
    return 'Console';
  }

  sendEmail(
    to: string,
    subject: string,
    content: string,
    options: EmailOptions = {},
  ): EmailResponse {
    try {
      this.logger.debug(
        `Email would be sent to ${to} with subject: ${subject}`,
      );
      this.logger.debug(`Email content: ${content}`);
      if (options.html) {
        this.logger.debug('Email is HTML formatted');
      }
      if (options.cc && options.cc.length > 0) {
        this.logger.debug(`CC: ${options.cc.join(', ')}`);
      }
      if (options.bcc && options.bcc.length > 0) {
        this.logger.debug(`BCC: ${options.bcc.join(', ')}`);
      }
      if (options.attachments && options.attachments.length > 0) {
        this.logger.debug(`Attachments: ${options.attachments.length} file(s)`);
      }

      // Simulate successful sending
      return {
        success: true,
        messageId: `console-${Date.now()}`,
      };
    } catch (error) {
      this.logger.error('Error in console email provider:', error);
      return {
        success: false,
        error: 'Console email provider error',
      };
    }
  }

  /**
   * Get provider configuration status
   */
  isProviderConfigured(): boolean {
    return true; // Console provider is always configured
  }
}
