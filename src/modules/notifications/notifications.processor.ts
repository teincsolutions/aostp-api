import { Processor, Process } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../../providers/storage/s3.service';
import type { EmailProvider } from '../../interfaces/email-provider.interface';
import type { SmsProvider } from '../../interfaces/sms-provider.interface';
import type { WhatsAppProvider } from '../../interfaces/whatsapp-provider.interface';
import {
  NotificationJobData,
  InvoiceNotificationJobData,
} from './notifications.queue';
import { NotificationChannel, NotificationType } from '@prisma/client';

@Processor('notifications-queue')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
    @Inject('EMAIL_PROVIDER') private readonly emailProvider: EmailProvider,
    @Inject('SMS_PROVIDER') private readonly smsProvider: SmsProvider,
    @Inject('WHATSAPP_PROVIDER')
    private readonly whatsAppProvider: WhatsAppProvider,
  ) {}

  @Process('send-invoice-notification')
  async handleInvoiceNotification(job: Job<NotificationJobData>) {
    this.logger.log(
      `Processing invoice notification job ${job.id} - Invoice: ${(job.data.data as InvoiceNotificationJobData).invoiceNumber}`,
    );

    const invoiceData = job.data.data as InvoiceNotificationJobData;

    try {
      // Fetch PDF from S3 if available
      let pdfBuffer: Buffer | null = null;
      let pdfFilename: string | null = null;

      if (invoiceData.invoicePdfKey) {
        try {
          this.logger.log(
            `Fetching PDF from S3: ${invoiceData.invoicePdfKey}`,
          );
          pdfBuffer = await this.s3Service.getFileBuffer(
            invoiceData.invoicePdfKey,
          );
          pdfFilename = `Invoice-${invoiceData.invoiceNumber}.pdf`;
          this.logger.log(`PDF fetched successfully: ${pdfFilename}`);
        } catch (pdfError) {
          this.logger.warn(
            `Failed to fetch PDF for invoice ${invoiceData.invoiceNumber}, sending without attachment`,
            pdfError,
          );
          // Continue without PDF attachment
        }
      }

      const results: any[] = [];

      // Send Email with PDF attachment
      if (invoiceData.customerEmail) {
        const emailResult = await this.sendInvoiceEmail(
          invoiceData,
          pdfBuffer,
          pdfFilename,
        );
        results.push(emailResult);
      }

      // Send SMS/WhatsApp (no attachment, just notification)
      if (invoiceData.customerPhoneNumber) {
        const smsResult = await this.sendInvoiceSmsOrWhatsApp(invoiceData);
        if (smsResult) {
          results.push(smsResult);
        }
      }

      this.logger.log(
        `Invoice notification job ${job.id} completed - Sent ${results.length} notification(s)`,
      );

      return {
        success: true,
        invoiceNumber: invoiceData.invoiceNumber,
        notificationsSent: results.length,
        results,
      };
    } catch (error) {
      this.logger.error(
        `Invoice notification job ${job.id} failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async sendInvoiceEmail(
    data: InvoiceNotificationJobData,
    pdfBuffer: Buffer | null,
    pdfFilename: string | null,
  ) {
    const customerName = `${data.customerFirstName}${data.customerLastName ? ' ' + data.customerLastName : ''}`;
    const packingListRow = data.packingListName
      ? `<tr><td><strong>Packing List:</strong></td><td>${data.packingListName}</td></tr>`
      : '';

    const dueDate = new Date(data.dueDate).toLocaleDateString();

    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Invoice Issued - AOSTP</h2>
        <p>Dear ${customerName},</p>
        <p>An invoice has been issued for your shipment.</p>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td><strong>Invoice Number:</strong></td><td>${data.invoiceNumber}</td></tr>
          ${packingListRow}
          <tr><td><strong>Total Amount:</strong></td><td>${data.currency} ${data.totalAmount}</td></tr>
          <tr><td><strong>Due Date:</strong></td><td>${dueDate}</td></tr>
        </table>
        <p>Please ensure payment is made before the due date.</p>
        ${pdfBuffer ? '<p><strong>Your invoice PDF is attached to this email.</strong></p>' : '<p>Please contact us if you need a copy of your invoice.</p>'}
        <p>Thank you for your business.</p>
      </div>
    `;

    const emailOptions: any = { html: true };

    if (pdfBuffer && pdfFilename) {
      emailOptions.attachments = [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ];
    }

    const result = await this.emailProvider.sendEmail(
      data.customerEmail!,
      'Invoice Issued - AOSTP Logistics',
      emailContent,
      emailOptions,
    );

    // Save notification record
    await this.prisma.notification.create({
      data: {
        customerId: data.customerId,
        type: NotificationType.INVOICE_ISSUED,
        channel: NotificationChannel.EMAIL,
        recipient: data.customerEmail!,
        subject: 'Invoice Issued - AOSTP Logistics',
        content: emailContent,
        metadata: {
          invoiceId: data.invoiceId,
          invoiceNumber: data.invoiceNumber,
          hasPdfAttachment: !!pdfBuffer,
        },
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        failReason: result.success ? null : result.error,
      },
    });

    this.logger.log(
      `Email sent to ${data.customerEmail} for invoice ${data.invoiceNumber} - Success: ${result.success}`,
    );

    return {
      channel: 'EMAIL',
      recipient: data.customerEmail,
      success: result.success,
      hasPdfAttachment: !!pdfBuffer,
    };
  }

  private async sendInvoiceSmsOrWhatsApp(data: InvoiceNotificationJobData) {
    const channel =
      data.customerPreferredChannel === 'WHATSAPP'
        ? NotificationChannel.WHATSAPP
        : data.customerPreferredChannel === 'SMS'
          ? NotificationChannel.SMS
          : null;

    if (!channel) {
      return null;
    }

    const dueDate = new Date(data.dueDate).toLocaleDateString();
    const content = `Hi ${data.customerFirstName}, invoice ${data.invoiceNumber} for ${data.currency}${data.totalAmount} is due ${dueDate}. Check your email for the invoice PDF.`;

    let result: { success: boolean; error?: string };

    if (channel === NotificationChannel.WHATSAPP) {
      result = await this.whatsAppProvider.sendMessage(
        data.customerPhoneNumber!,
        content,
      );
    } else {
      result = await this.smsProvider.sendSms(
        data.customerPhoneNumber!,
        content,
      );
    }

    // Save notification record
    await this.prisma.notification.create({
      data: {
        customerId: data.customerId,
        type: NotificationType.INVOICE_ISSUED,
        channel,
        recipient: data.customerPhoneNumber!,
        content,
        metadata: {
          invoiceId: data.invoiceId,
          invoiceNumber: data.invoiceNumber,
        },
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        failReason: result.success ? null : result.error,
      },
    });

    this.logger.log(
      `${channel} sent to ${data.customerPhoneNumber} for invoice ${data.invoiceNumber} - Success: ${result.success}`,
    );

    return {
      channel,
      recipient: data.customerPhoneNumber,
      success: result.success,
    };
  }
}
