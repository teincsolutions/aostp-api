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
  private readonly isConfigured = true; // always true in sendmail mode
  private readonly defaultFrom: string;

  constructor(private configService: ConfigService) {
    this.defaultFrom = this.configService.get<string>(
      'EMAIL_FROM',
      'noreply@aostp.com',
    );

    const transportMode = this.configService.get<string>(
      'EMAIL_TRANSPORT',
      'sendmail',
    );

    if (transportMode === 'sendmail') {
      /** ─────────────────────────────────────────
       *  ✔ DIRECTUS-STYLE SENDMAIL MODE
       *  ✔ No SMTP login
       *  ✔ No App Password
       *  ✔ Works from Docker/Hetzner instantly
       *  ───────────────────────────────────────── */
      this.transporter = nodemailer.createTransport({
        sendmail: true,
        newline: 'unix',
        path: '/usr/bin/msmtp',
      });

      this.logger.log('Using sendmail transport (Directus mode)');
    } else {
      /** Optional: Keep SMTP fallback if needed */
      const smtpHost = this.configService.get<string>('SMTP_HOST');
      const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
      const smtpUser = this.configService.get<string>('SMTP_USER');
      const smtpPass = this.configService.get<string>('SMTP_PASS');
      const smtpSecure = this.configService.get<boolean>('SMTP_SECURE', false);

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      this.logger.log('Using SMTP transport');
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
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: options.from || this.defaultFrom,
        to,
        subject,
        html: options.html ? content : undefined,
        text: !options.html ? content : undefined,
      };

      if (options.cc?.length) mailOptions.cc = options.cc;
      if (options.bcc?.length) mailOptions.bcc = options.bcc;
      if (options.attachments?.length) {
        mailOptions.attachments = options.attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
          encoding: a.encoding,
        }));
      }

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.debug('Email sent', { messageId: info.messageId });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      this.logger.error('Sendmail/Nodemailer Error:', error);

      return {
        success: false,
        error: error.message || 'Error sending email',
      };
    }
  }

  getDefaultFrom(): string {
    return this.defaultFrom;
  }

  isProviderConfigured(): boolean {
    return this.isConfigured;
  }
}
