import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  NotificationType,
  NotificationChannel,
  Customer,
  Package,
  Invoice,
  Payment,
  Container,
} from '@prisma/client';

interface NotificationData {
  customer: Customer;
  type: NotificationType;
  subject?: string;
  content: string;
  metadata?: any;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async sendNotification(data: NotificationData): Promise<any[]> {
    const { customer, type, subject, content, metadata } = data;
    const notifications: Promise<any>[] = [];

    // Always send email if available
    if (customer.email) {
      notifications.push(
        this.createNotification({
          customerId: customer.id,
          type,
          channel: NotificationChannel.EMAIL,
          recipient: customer.email,
          subject: subject || this.getDefaultSubject(type),
          content,
          metadata,
        }),
      );
    }

    // Send SMS or WhatsApp based on preference
    if (customer.phoneNumber) {
      const channel =
        customer.preferredChannel === NotificationChannel.WHATSAPP
          ? NotificationChannel.WHATSAPP
          : customer.preferredChannel === NotificationChannel.SMS
            ? NotificationChannel.SMS
            : null;

      if (channel) {
        notifications.push(
          this.createNotification({
            customerId: customer.id,
            type,
            channel,
            recipient: customer.phoneNumber,
            subject: subject || this.getDefaultSubject(type),
            content,
            metadata,
          }),
        );
      }
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
    // TODO: Implement email provider integration
    this.logger.debug(
      `Email would be sent to ${notification.recipient}: ${notification.content}`,
    );
    // For now, just log the email
    return Promise.resolve();
  }

  private async sendSMS(notification: any) {
    // TODO: Implement SMS provider integration (Twilio, etc.)
    this.logger.debug(
      `SMS would be sent to ${notification.recipient}: ${notification.content}`,
    );
    // For now, just log the SMS
    return Promise.resolve();
  }

  private async sendWhatsApp(notification: any) {
    // TODO: Implement WhatsApp provider integration
    this.logger.debug(
      `WhatsApp message would be sent to ${notification.recipient}: ${notification.content}`,
    );
    // For now, just log the WhatsApp message
    return Promise.resolve();
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
    const content = `Dear ${pkg.customer.firstName} ${pkg.customer.lastName},

Your package has been received and registered in our system.

Tracking Code: ${pkg.trackingCode}
Description: ${pkg.description}
Weight: ${pkg.weight} KG
Shipping Mode: ${pkg.shippingMode}
Status: ${pkg.status}

You can track your package using the tracking code provided.

Thank you for choosing AOSTP Logistics.`;

    return this.sendNotification({
      customer: pkg.customer,
      type: NotificationType.PACKAGE_INTAKE,
      content,
      metadata: {
        packageId: pkg.id,
        trackingCode: pkg.trackingCode,
      },
    });
  }

  async notifyInvoiceIssued(invoice: Invoice & { customer: Customer }) {
    const content = `Dear ${invoice.customer.firstName} ${invoice.customer.lastName},

An invoice has been issued for your shipment.

Invoice Number: ${invoice.invoiceNumber}
Total Amount: ${invoice.currency} ${invoice.totalAmount}
Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}

Please ensure payment is made before the due date.

Thank you for your business.`;

    return this.sendNotification({
      customer: invoice.customer,
      type: NotificationType.INVOICE_ISSUED,
      content,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    });
  }

  async notifyPaymentReceived(payment: Payment & { customer: Customer }) {
    const content = `Dear ${payment.customer.firstName} ${payment.customer.lastName},

We have received your payment.

Payment Code: ${payment.paymentCode}
Amount: ${payment.currency} ${payment.amount}
Payment Method: ${payment.paymentMethod}
Date: ${new Date(payment.processedAt).toLocaleDateString()}

Thank you for your prompt payment.`;

    return this.sendNotification({
      customer: payment.customer,
      type: NotificationType.PAYMENT_RECEIVED,
      content,
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
    const content = `Dear ${pkg.customer.firstName} ${pkg.customer.lastName},

Your package status has been updated.

Tracking Code: ${pkg.trackingCode}
Previous Status: ${oldStatus}
New Status: ${pkg.status}

${this.getStatusMessage(pkg.status)}

Thank you for choosing AOSTP Logistics.`;

    return this.sendNotification({
      customer: pkg.customer,
      type: NotificationType.SHIPMENT_UPDATE,
      content,
      metadata: {
        packageId: pkg.id,
        trackingCode: pkg.trackingCode,
        oldStatus,
        newStatus: pkg.status,
      },
    });
  }

  async notifyContainerArrival(
    container: Container,
    customers: Customer[],
  ): Promise<any[]> {
    const notifications: Promise<any>[] = [];

    for (const customer of customers) {
      const content = `Dear ${customer.firstName} ${customer.lastName},

We are pleased to inform you that the container carrying your shipment has arrived.

Container Number: ${container.containerNumber}
Arrival Date: ${new Date(container.actualArrival || new Date()).toLocaleDateString()}
Origin: ${container.departureCity}
Destination: ${container.destinationCity}

Please prepare for collection of your packages.

Thank you for your patience.`;

      notifications.push(
        this.sendNotification({
          customer,
          type: NotificationType.CONTAINER_ARRIVAL,
          content,
          metadata: {
            containerId: container.id,
            containerNumber: container.containerNumber,
          },
        }),
      );
    }

    return Promise.all(notifications);
  }

  private getStatusMessage(status: string): string {
    const messages: Record<string, string> = {
      RECEIVED: 'Your package has been received at our facility.',
      IN_WAREHOUSE: 'Your package is stored in our warehouse.',
      IN_PACKING_LIST:
        'Your package has been added to a packing list for shipment.',
      SHIPPED: 'Your package has been shipped and is in transit.',
      ARRIVED: 'Your package has arrived at the destination.',
      DELIVERED: 'Your package has been delivered successfully.',
      CANCELLED: 'Your package shipment has been cancelled.',
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

    for (const notification of failedNotifications) {
      await this.processNotification(notification);
    }

    return {
      retried: failedNotifications.length,
    };
  }
}
