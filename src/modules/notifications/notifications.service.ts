import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GetNotificationsDto } from './dto/notifications.filter.dto';
import {
  NotificationType,
  NotificationChannel,
  Customer,
  Package,
  Invoice,
  Payment,
} from '@prisma/client';
import type { SmsProvider } from '../../interfaces/sms-provider.interface';
import type { EmailProvider } from '../../interfaces/email-provider.interface';
import type { WhatsAppProvider } from '../../interfaces/whatsapp-provider.interface';
import * as fs from 'fs';
import * as path from 'path';

interface NotificationChannelContent {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  content: string;
}

interface NotificationData {
  customer: Customer;
  type: NotificationType;
  channels: NotificationChannelContent[];
  metadata?: any;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject('SMS_PROVIDER') private readonly smsProvider: SmsProvider,
    @Inject('EMAIL_PROVIDER') private readonly emailProvider: EmailProvider,
    @Inject('WHATSAPP_PROVIDER')
    private readonly whatsAppProvider: WhatsAppProvider,
  ) {}

  async sendNotification(data: NotificationData): Promise<any[]> {
    const { customer, type, channels, metadata } = data;
    const notifications: Promise<any>[] = [];

    for (const channelData of channels) {
      notifications.push(
        this.createNotification({
          customerId: customer.id,
          type,
          channel: channelData.channel,
          recipient: channelData.recipient,
          subject: channelData.subject || this.getDefaultSubject(type),
          content: channelData.content,
          metadata,
        }),
      );
    }

    // Save notifications to database
    const createdNotifications = await Promise.all(notifications);

    // Process notifications (send via providers)
    for (const notification of createdNotifications) {
      await this.processNotification(notification);
    }

    return createdNotifications;
  }

  private async createNotification(data: {
    customerId: string;
    type: NotificationType;
    channel: NotificationChannel;
    recipient: string;
    subject?: string;
    content: string;
    metadata?: any;
  }) {
    return this.prisma.notification.create({
      data: {
        customerId: data.customerId,
        type: data.type,
        channel: data.channel,
        recipient: data.recipient,
        subject: data.subject,
        content: data.content,
        metadata: data.metadata,
        status: 'PENDING',
      },
    });
  }

  private async processNotification(notification: any) {
    try {
      switch (notification.channel) {
        case NotificationChannel.EMAIL:
          await this.sendEmail(notification);
          break;
        case NotificationChannel.SMS:
          await this.sendSMS(notification);
          break;
        case NotificationChannel.WHATSAPP:
          await this.sendWhatsApp(notification);
          break;
      }

      // Mark as sent
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      this.logger.log(
        `Notification sent: ${notification.type} via ${notification.channel} to ${notification.recipient}`,
      );
    } catch (error) {
      // Mark as failed
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          failReason: error.message,
        },
      });

      this.logger.error(
        `Failed to send notification: ${notification.type} via ${notification.channel}`,
        error,
      );
    }
  }

  private async sendEmail(notification: any) {
    try {
      const result = await this.emailProvider.sendEmail(
        notification.recipient,
        notification.subject || 'AOSTP Logistics Notification',
        notification.content,
        { html: true }, // Most notification content is HTML
      );

      if (!result.success) {
        throw new Error(result.error || 'Email sending failed');
      }

      this.logger.debug(
        `Email sent successfully to ${notification.recipient} with messageId: ${result.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${notification.recipient}:`,
        error,
      );
      throw error; // Re-throw to be caught by processNotification
    }
  }

  private async sendSMS(notification: any) {
    try {
      const result = await this.smsProvider.sendSms(
        notification.recipient,
        notification.content,
      );

      if (!result.success) {
        // Create detailed failure information
        const failureDetails = {
          provider: this.smsProvider.getName(),
          error: result.error || 'SMS sending failed',
          recipient: notification.recipient,
          contentLength: notification.content?.length || 0,
          timestamp: new Date().toISOString(),
        };

        throw new Error(
          `${failureDetails.provider} SMS failed: ${failureDetails.error} | Recipient: ${failureDetails.recipient} | Content Length: ${failureDetails.contentLength}`,
        );
      }

      this.logger.debug(
        `SMS sent successfully to ${notification.recipient} with messageId: ${result.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${notification.recipient}:`,
        error,
      );

      // Store detailed error information in metadata for better debugging
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          metadata: {
            ...notification.metadata,
            failureDetails: {
              provider: this.smsProvider.getName(),
              error: error.message,
              recipient: notification.recipient,
              contentLength: notification.content?.length || 0,
              timestamp: new Date().toISOString(),
            },
          },
        },
      });

      throw error; // Re-throw to be caught by processNotification
    }
  }

  private async sendWhatsApp(notification: any) {
    try {
      const result = await this.whatsAppProvider.sendMessage(
        notification.recipient,
        notification.content,
      );

      if (!result.success) {
        throw new Error(result.error || 'WhatsApp sending failed');
      }

      this.logger.debug(
        `WhatsApp message sent successfully to ${notification.recipient} with messageId: ${result.messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message to ${notification.recipient}:`,
        error,
      );
      throw error; // Re-throw to be caught by processNotification
    }
  }

  private getDefaultSubject(type: NotificationType): string {
    const subjects = {
      PACKAGE_INTAKE: 'Package Received - AOSTP Logistics',
      INVOICE_ISSUED: 'Invoice Issued - AOSTP Logistics',
      PAYMENT_RECEIVED: 'Payment Received - AOSTP Logistics',
      SHIPMENT_UPDATE: 'Shipment Update - AOSTP Logistics',
      CONTAINER_ARRIVAL: 'Container Arrival Notice - AOSTP Logistics',
    };
    return subjects[type] || 'AOSTP Logistics Notification';
  }

  // Notification templates
  async notifyPackageIntake(pkg: Package & { customer: Customer }) {
    const channels: NotificationChannelContent[] = [];

    // Email content (HTML)
    if (pkg.customer.email) {
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Package Received - AOSTP Logistics</h2>
          <p>Dear ${pkg.customer.firstName} ${pkg.customer.lastName},</p>
          <p>Your package has been received and registered in our system.</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td><strong>Tracking Code:</strong></td><td>${pkg.trackingCode}</td></tr>
            <tr><td><strong>Description:</strong></td><td>${pkg.description}</td></tr>
            <tr><td><strong>Shipping Mode:</strong></td><td>${pkg.shippingMode}</td></tr>
            <tr><td><strong>Status:</strong></td><td>${pkg.status}</td></tr>
          </table>
          <p>You can <a href="https://aostp.akomapacargo.com/track/${pkg.trackingCode}" target="_blank">track your package</a> using the tracking code provided.</p>
          <p>Thank you for choosing AOSTP Logistics.</p>
        </div>
      `;
      channels.push({
        channel: NotificationChannel.EMAIL,
        recipient: pkg.customer.email,
        subject: 'Package Received - AOSTP Logistics',
        content: emailContent,
      });
    }

    // SMS/WhatsApp content (short, plain)
    if (pkg.customer.phoneNumber) {
      const channel =
        pkg.customer.preferredChannel === NotificationChannel.WHATSAPP
          ? NotificationChannel.WHATSAPP
          : pkg.customer.preferredChannel === NotificationChannel.SMS
            ? NotificationChannel.SMS
            : null;

      if (channel) {
        const content = `Hi ${pkg.customer.firstName}, your package (${pkg.trackingCode}) has been received at AOSTP Logistics. Track: https://aostp.akomapacargo.com/track/${pkg.trackingCode}`;
        channels.push({
          channel,
          recipient: pkg.customer.phoneNumber,
          content,
        });
      }
    }

    return this.sendNotification({
      customer: pkg.customer,
      type: NotificationType.PACKAGE_INTAKE,
      channels,
      metadata: {
        packageId: pkg.id,
        trackingCode: pkg.trackingCode,
      },
    });
  }

  async notifyDeliveryReleased(
    customer: Customer,
    pkg: Package,
    delivery: any,
  ) {
    const channels: NotificationChannelContent[] = [];

    // Email content (HTML)
    if (customer.email) {
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Package Released for Delivery - AOSTP Logistics</h2>
          <p>Dear ${customer.firstName} ${customer.lastName},</p>
          <p>We are pleased to inform you that your package has been released for delivery.</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td><strong>Tracking Code:</strong></td><td>${pkg.trackingCode}</td></tr>
            <tr><td><strong>Package Description:</strong></td><td>${pkg.description}</td></tr>
            <tr><td><strong>Delivery ID:</strong></td><td>${delivery.deliveryId}</td></tr>
            <tr><td><strong>Released Quantity:</strong></td><td>${delivery.quantity}</td></tr>
            <tr><td><strong>Receiver:</strong></td><td>${delivery.receiverName || 'As indicated'}</td></tr>
          </table>
          <p>Please contact us if you need any assistance with collection.</p>
          <p>You can <a href="https://aostp.akomapacargo.com/track/${pkg.trackingCode}" target="_blank">track your package</a> for updates.</p>
          <p>Thank you for choosing AOSTP Logistics.</p>
        </div>
      `;
      channels.push({
        channel: NotificationChannel.EMAIL,
        recipient: customer.email,
        subject: 'Package Released for Delivery - AOSTP Logistics',
        content: emailContent,
      });
    }

    // SMS/WhatsApp content (short, plain)
    if (customer.phoneNumber) {
      const channel =
        customer.preferredChannel === NotificationChannel.WHATSAPP
          ? NotificationChannel.WHATSAPP
          : customer.preferredChannel === NotificationChannel.SMS
            ? NotificationChannel.SMS
            : null;

      if (channel) {
        const content = `Hi ${customer.firstName}, your package (${pkg.trackingCode}) is ready for collection. Delivery ID: ${delivery.deliveryId}. Track: https://aostp.akomapacargo.com/track/${pkg.trackingCode}`;
        channels.push({
          channel,
          recipient: customer.phoneNumber,
          content,
        });
      }
    }

    return this.sendNotification({
      customer,
      type: NotificationType.DELIVERY_RELEASED,
      channels,
      metadata: {
        packageId: pkg.id,
        trackingCode: pkg.trackingCode,
        deliveryId: delivery.deliveryId,
      },
    });
  }

  async notifyInvoiceIssued(invoice: Invoice & { customer: Customer }) {
    const channels: NotificationChannelContent[] = [];

    // Email content (HTML)
    if (invoice.customer.email) {
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invoice Issued - AOSTP Logistics</h2>
          <p>Dear ${invoice.customer.firstName} ${invoice.customer.lastName},</p>
          <p>An invoice has been issued for your shipment.</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td><strong>Invoice Number:</strong></td><td>${invoice.invoiceNumber}</td></tr>
            <tr><td><strong>Total Amount:</strong></td><td>${invoice.currency} ${invoice.totalAmount}</td></tr>
            <tr><td><strong>Due Date:</strong></td><td>${new Date(invoice.dueDate).toLocaleDateString()}</td></tr>
          </table>
          <p>Please ensure payment is made before the due date.</p>
          <p>You can <a href="https://aostp.akomapacargo.com/invoices/${invoice.invoiceNumber}" target="_blank">view your invoice</a> for details.</p>
          <p>Thank you for your business.</p>
        </div>
      `;
      channels.push({
        channel: NotificationChannel.EMAIL,
        recipient: invoice.customer.email,
        subject: 'Invoice Issued - AOSTP Logistics',
        content: emailContent,
      });
    }

    // SMS/WhatsApp content (short, plain)
    if (invoice.customer.phoneNumber) {
      const channel =
        invoice.customer.preferredChannel === NotificationChannel.WHATSAPP
          ? NotificationChannel.WHATSAPP
          : invoice.customer.preferredChannel === NotificationChannel.SMS
            ? NotificationChannel.SMS
            : null;

      if (channel) {
        const content = `Hi ${invoice.customer.firstName}, invoice ${invoice.invoiceNumber} for ${invoice.currency}${invoice.totalAmount} is due ${new Date(invoice.dueDate).toLocaleDateString()}. View: https://aostp.akomapacargo.com/invoices/${invoice.invoiceNumber}`;
        channels.push({
          channel,
          recipient: invoice.customer.phoneNumber,
          content,
        });
      }
    }

    return this.sendNotification({
      customer: invoice.customer,
      type: NotificationType.INVOICE_ISSUED,
      channels,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    });
  }

  async notifyPaymentReceived(payment: Payment & { customer: Customer }) {
    const channels: NotificationChannelContent[] = [];

    // Email content (HTML)
    if (payment.customer.email) {
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment Received - AOSTP Logistics</h2>
          <p>Dear ${payment.customer.firstName} ${payment.customer.lastName},</p>
          <p>We have received your payment. Thank you for your prompt payment.</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td><strong>Payment Code:</strong></td><td>${payment.paymentCode}</td></tr>
            <tr><td><strong>Amount:</strong></td><td>${payment.currency} ${payment.amount}</td></tr>
            <tr><td><strong>Payment Method:</strong></td><td>${payment.paymentMethod}</td></tr>
            <tr><td><strong>Date:</strong></td><td>${new Date(payment.processedAt).toLocaleDateString()}</td></tr>
          </table>
          <p>You can <a href="https://aostp.akomapacargo.com/receipts/${payment.paymentCode}" target="_blank">view your receipt</a> for details.</p>
        </div>
      `;
      channels.push({
        channel: NotificationChannel.EMAIL,
        recipient: payment.customer.email,
        subject: 'Payment Received - AOSTP Logistics',
        content: emailContent,
      });
    }

    // SMS/WhatsApp content (short, plain)
    if (payment.customer.phoneNumber) {
      const channel =
        payment.customer.preferredChannel === NotificationChannel.WHATSAPP
          ? NotificationChannel.WHATSAPP
          : payment.customer.preferredChannel === NotificationChannel.SMS
            ? NotificationChannel.SMS
            : null;

      if (channel) {
        const content = `Hi ${payment.customer.firstName}, payment ${payment.currency}${payment.amount} for ${payment.paymentCode} received. Thank you! Receipt: https://aostp.akomapacargo.com/receipts/${payment.paymentCode}`;
        channels.push({
          channel,
          recipient: payment.customer.phoneNumber,
          content,
        });
      }
    }

    return this.sendNotification({
      customer: payment.customer,
      type: NotificationType.PAYMENT_RECEIVED,
      channels,
      metadata: {
        paymentId: payment.id,
        paymentCode: payment.paymentCode,
      },
    });
  }

  async notifyShipmentUpdate(
    pkg: Package & { customer: Customer },
    oldStatus: string,
  ) {
    const channels: NotificationChannelContent[] = [];

    // Email content (HTML)
    if (pkg.customer.email) {
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Package Status Update - AOSTP Logistics</h2>
          <p>Dear ${pkg.customer.firstName} ${pkg.customer.lastName},</p>
          <p>Your package status has been updated.</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td><strong>Tracking Code:</strong></td><td>${pkg.trackingCode}</td></tr>
            <tr><td><strong>Previous Status:</strong></td><td>${oldStatus}</td></tr>
            <tr><td><strong>New Status:</strong></td><td>${pkg.status}</td></tr>
          </table>
          <p>${this.getStatusMessage(pkg.status)}</p>
          <p>You can <a href="https://aostp.akomapacargo.com/track/${pkg.trackingCode}" target="_blank">track your package</a> for real-time updates.</p>
          <p>Thank you for choosing AOSTP Logistics.</p>
        </div>
      `;
      channels.push({
        channel: NotificationChannel.EMAIL,
        recipient: pkg.customer.email,
        subject: 'Package Status Update - AOSTP Logistics',
        content: emailContent,
      });
    }

    // SMS/WhatsApp content (short, plain)
    if (pkg.customer.phoneNumber) {
      const channel =
        pkg.customer.preferredChannel === NotificationChannel.WHATSAPP
          ? NotificationChannel.WHATSAPP
          : pkg.customer.preferredChannel === NotificationChannel.SMS
            ? NotificationChannel.SMS
            : null;

      if (channel) {
        const content = `Hi ${pkg.customer.firstName}, your package (${pkg.trackingCode}) status: ${oldStatus} → ${pkg.status}. Track: https://aostp.akomapacargo.com/track/${pkg.trackingCode}`;
        channels.push({
          channel,
          recipient: pkg.customer.phoneNumber,
          content,
        });
      }
    }

    return this.sendNotification({
      customer: pkg.customer,
      type: NotificationType.SHIPMENT_UPDATE,
      channels,
      metadata: {
        packageId: pkg.id,
        trackingCode: pkg.trackingCode,
        oldStatus,
        newStatus: pkg.status,
      },
    });
  }

  async notifyContainerArrival(
    container,
    customers: Customer[],
  ): Promise<any[]> {
    const notifications: Promise<any[]>[] = [];

    for (const customer of customers) {
      const channels: NotificationChannelContent[] = [];

      // Email content (HTML)
      if (customer.email) {
        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Container Arrival Notice - AOSTP Logistics</h2>
            <p>Dear ${customer.firstName} ${customer.lastName},</p>
            <p>We are pleased to inform you that the container carrying your shipment has arrived.</p>
            <table style="border-collapse: collapse; width: 100%;">
              <tr><td><strong>Container Number:</strong></td><td>${container.containerNumber}</td></tr>
              <tr><td><strong>Arrival Date:</strong></td><td>${new Date(container.actualArrival || new Date()).toLocaleDateString()}</td></tr>
              <tr><td><strong>Origin:</strong></td><td>${container.departureCity?.name}</td></tr>
              <tr><td><strong>Destination:</strong></td><td>${container.destinationCity?.name}</td></tr>
            </table>
            <p>Please prepare for collection of your packages.</p>
            <p>Thank you for your patience.</p>
          </div>
        `;
        channels.push({
          channel: NotificationChannel.EMAIL,
          recipient: customer.email,
          subject: 'Container Arrival Notice - AOSTP Logistics',
          content: emailContent,
        });
      }

      // SMS/WhatsApp content (short, plain)
      if (customer.phoneNumber) {
        const channel =
          customer.preferredChannel === NotificationChannel.WHATSAPP
            ? NotificationChannel.WHATSAPP
            : customer.preferredChannel === NotificationChannel.SMS
              ? NotificationChannel.SMS
              : null;

        if (channel) {
          const content = `Hi ${customer.firstName}, container ${container.containerNumber} has arrived from ${container.departureCity?.name} to ${container.destinationCity?.name}. Prepare for package collection.`;
          channels.push({
            channel,
            recipient: customer.phoneNumber,
            content,
          });
        }
      }

      notifications.push(
        this.sendNotification({
          customer,
          type: NotificationType.CONTAINER_ARRIVAL,
          channels,
          metadata: {
            containerId: container.id,
            containerNumber: container.containerNumber,
          },
        }),
      );
    }

    const results = await Promise.all(notifications);
    return results.flat(); // Since each sends multiple, flatten
  }

  private getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      RECEIVED: 'Your package has been received at our facility.',
      ASSIGNED:
        'Your package has been assigned to a packing list for shipment.',
      SHIPPED: 'Your package has been shipped and is in transit.',
      ARRIVED: 'Your package has arrived at the destination.',
      RELEASED: 'Your package has been released for delivery.',
    };
    return messages[status] || 'Your package status has been updated.';
  }

  // Get notification history for a customer
  async getCustomerNotifications(customerId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Retry failed notifications
  async retryFailedNotifications() {
    const failedNotifications = await this.prisma.notification.findMany({
      where: {
        status: 'FAILED',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    if (failedNotifications.length === 0) {
      return {
        retried: 0,
        message: 'No failed notifications found in the last 24 hours',
      };
    }

    // Process notifications in the background to avoid timeout
    this.processFailedNotificationsInBackground(failedNotifications);

    this.logger.log(
      `Started background retry of ${failedNotifications.length} failed notifications`,
    );

    return {
      retried: failedNotifications.length,
      message: `Retry initiated for ${failedNotifications.length} notifications. They will be processed in the background.`,
    };
  }

  // Retry a single failed notification by ID
  async retrySingleNotification(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.status !== 'FAILED') {
      throw new Error('Notification is not in failed status');
    }

    await this.processNotification(notification);

    return {
      success: true,
      notificationId: id,
      status: 'Retry initiated',
    };
  }

  // Process failed notifications in background using concurrent batches
  private processFailedNotificationsInBackground(notifications: any[]) {
    // Fire and forget - don't block the response
    setImmediate(() => {
      // Execute the async processing function
      void this.doBackgroundProcessing(notifications);
    });
  }

  private async doBackgroundProcessing(notifications: any[]) {
    const batchSize = 10; // Process 10 notifications at a time
    let processed = 0;
    let success = 0;
    let failed = 0;

    this.logger.log(
      `Starting background retry processing of ${notifications.length} notifications in batches of ${batchSize}`,
    );

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);

      // Process batch concurrently
      const batchPromises = batch.map(async (notification) => {
        try {
          await this.processNotification(notification);
          return { success: true };
        } catch (error) {
          this.logger.error(
            `Failed to retry notification ${notification.id}:`,
            error.message,
          );
          return { error: true };
        }
      });

      const results = await Promise.all(batchPromises);
      processed += batch.length;
      success += results.filter((r) => !r.error).length;
      failed += results.filter((r) => r.error).length;

      this.logger.log(
        `Processed ${processed}/${notifications.length} notifications. Success: ${success}, Failed: ${failed}`,
      );

      // Small delay between batches to prevent overwhelming the providers
      if (i + batchSize < notifications.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.logger.log(
      `Background retry processing completed. Total: ${processed}, Success: ${success}, Failed: ${failed}`,
    );
  }

  // Get all failed notifications
  async getFailedNotifications(limit = 100) {
    return this.prisma.notification.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Get all notifications with filters
  async getAllNotifications(dto: GetNotificationsDto) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      channel,
      status,
      dateFrom,
      dateTo,
      customerId,
      recipient,
      search,
    } = dto;

    const where: any = {};

    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (recipient) where.recipient = recipient;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortableFields = ['createdAt', 'sentAt', 'type'];
    const orderBy: any = {};
    if (sortableFields.includes(sortBy)) {
      orderBy[sortBy] = sortOrder;
    } else {
      orderBy.createdAt = 'desc';
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Public method to send test SMS
  async sendTestSms(phoneNumber: string, message?: string): Promise<any> {
    return this.smsProvider.sendSms(
      phoneNumber,
      message || 'Test SMS from AOSTP Logistics',
    );
  }

  // Send welcome email to newly created user
  async notifyUserCreated(user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
    tempPassword: string;
  }): Promise<any> {
    if (!user.email) {
      this.logger.warn(
        `Cannot send welcome email to user ${user.username} - no email address provided`,
      );
      return null;
    }

    // Read email template
    // Try production path first (dist/templates), then fallback to source (src/templates)
    let templatePath = path.join(
      process.cwd(),
      'dist',
      'templates',
      'emails',
      'user-created.html',
    );

    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(
        process.cwd(),
        'src',
        'templates',
        'emails',
        'user-created.html',
      );
    }

    let emailContent = fs.readFileSync(templatePath, 'utf-8');

    // Replace placeholders
    const loginUrl =
      this.configService.get('FRONTEND_URL') ||
      'https://aostp.akomapacargo.com';

    emailContent = emailContent
      .replace(/{{firstName}}/g, user.firstName)
      .replace(/{{lastName}}/g, user.lastName)
      .replace(/{{email}}/g, user.email)
      .replace(/{{username}}/g, user.username)
      .replace(/{{password}}/g, user.tempPassword)
      .replace(/{{role}}/g, user.role)
      .replace(/{{loginUrl}}/g, loginUrl);

    try {
      const result = await this.emailProvider.sendEmail(
        user.email,
        'Welcome to AOSTP Logistics - Your Account is Ready',
        emailContent,
        { html: true },
      );

      if (!result.success) {
        this.logger.error(
          `Failed to send welcome email to ${user.email}:`,
          result.error,
        );
        return null;
      }

      this.logger.log(
        `Welcome email sent successfully to ${user.email} (${user.username})`,
      );

      return {
        success: true,
        messageId: result.messageId,
        recipient: user.email,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${user.email}:`,
        error,
      );
      return null;
    }
  }

  // Send password reset email
  async notifyPasswordReset(user: {
    email: string;
    firstName: string;
    lastName: string;
    resetToken: string;
  }): Promise<any> {
    if (!user.email) {
      this.logger.warn('Cannot send password reset email - no email provided');
      return null;
    }

    // Read email template
    let templatePath = path.join(
      process.cwd(),
      'dist',
      'templates',
      'emails',
      'password-reset.html',
    );

    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(
        process.cwd(),
        'src',
        'templates',
        'emails',
        'password-reset.html',
      );
    }

    let emailContent = fs.readFileSync(templatePath, 'utf-8');

    // Build reset URL
    const frontendUrl =
      this.configService.get('FRONTEND_URL') ||
      'https://aostp.akomapacargo.com';
    const resetUrl = `${frontendUrl}/reset-password?token=${user.resetToken}`;

    // Replace placeholders
    emailContent = emailContent
      .replace(/{{firstName}}/g, user.firstName)
      .replace(/{{lastName}}/g, user.lastName)
      .replace(/{{resetUrl}}/g, resetUrl);

    try {
      const result = await this.emailProvider.sendEmail(
        user.email,
        'Reset Your Password - AOSTP Logistics',
        emailContent,
        { html: true },
      );

      if (!result.success) {
        this.logger.error(
          `Failed to send password reset email to ${user.email}:`,
          result.error,
        );
        return null;
      }

      this.logger.log(
        `Password reset email sent successfully to ${user.email}`,
      );

      return {
        success: true,
        messageId: result.messageId,
        recipient: user.email,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${user.email}:`,
        error,
      );
      return null;
    }
  }
}
