import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  EmailProvider,
  EmailResponse,
  EmailOptions,
} from '../../interfaces/email-provider.interface';

@Injectable()
export class NodemailerProvider implements EmailProvider {
  private readonly logger = new Logger(NodemailerProvider.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly isConfigured: boolean;
  private readonly defaultFrom: string;

  constructor(private configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpSecure = this.configService.get<boolean>('SMTP_SECURE', false);

    this.defaultFrom = this.configService.get<string>(
      'EMAIL_FROM',
      'noreply@aostp.com',
    );

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      this.isConfigured = true;
      this.logger.log('Nodemailer email provider initialized');
    } else {
      this.isConfigured = false;
      this.logger.warn(
        'Nodemailer email provider is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in environment variables.',
      );
    }
  }

  getName(): string {
    return 'Nodemailer';
  }

  async sendEmail(
    to: string,
    subject: string,
    content: string,
    options: EmailOptions = {},
  ): Promise<EmailResponse> {
    if (!this.isConfigured) {
      this.logger.error('Nodemailer email provider is not configured');
      return {
        success: false,
        error:
          'Nodemailer email provider is not configured. Please configure SMTP settings.',
      };
    }

    try {
      this.logger.debug(`Sending email to ${to} with subject: ${subject}`);

      const mailOptions: nodemailer.SendMailOptions = {
        from: options.from || this.defaultFrom,
        to,
        subject,
        html: options.html ? content : undefined,
        text: !options.html ? content : undefined,
      };

      if (options.cc && options.cc.length > 0) {
        mailOptions.cc = options.cc;
      }

      if (options.bcc && options.bcc.length > 0) {
        mailOptions.bcc = options.bcc;
      }

      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
          encoding: attachment.encoding,
        }));
      }

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.debug('Email sent successfully', {
        messageId: info.messageId,
        response: info.response,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error('Error sending email via Nodemailer:', error);

      let errorMessage = 'Failed to send email via Nodemailer';
      if (error.response) {
        errorMessage = error.response || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Nodemailer email provider is not configured',
      };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      this.logger.error('SMTP connection verification failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get provider configuration status
   */
  isProviderConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Get default from address
   */
  getDefaultFrom(): string {
    return this.defaultFrom;
  }
}
