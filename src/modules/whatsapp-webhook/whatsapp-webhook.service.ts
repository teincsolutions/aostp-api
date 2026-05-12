import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v25.0';
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {
    this.accessToken =
      this.configService.get<string>('WHATSAPP_ACCESS_TOKEN') || '';
    this.phoneNumberId =
      this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';

    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn(
        'WhatsApp credentials not configured. Webhook will not be able to reply.',
      );
    }
  }

  async handleTextMessage(from: string, text: string): Promise<void> {
    const normalized = text.trim().toUpperCase();
    const parts = normalized.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1).join(' ');

    try {
      switch (command) {
        case 'TRACK':
          return this.handleTrackCommand(from, args);
        case 'PHONE':
          return this.handlePhoneCommand(from, args);
        default:
          return this.sendReply(from, this.getHelpMessage());
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle message from ${from}: ${error.message}`,
      );
      return this.sendReply(
        from,
        'Sorry, something went wrong. Please try again later.',
      );
    }
  }

  private async handleTrackCommand(from: string, code: string): Promise<void> {
    if (!code) {
      return this.sendReply(
        from,
        'Please provide a tracking code. Example:\nTRACK AOSTP-123',
      );
    }

    const pkg = await this.prisma.package.findFirst({
      where: {
        OR: [
          { trackingCode: code },
          { items: { some: { intakeTrackingCode: code } } },
        ],
      },
      include: {
        customer: true,
        warehouse: true,
        packingList: {
          include: {
            container: {
              include: { departureCity: true, destinationCity: true },
            },
          },
        },
        invoice: true,
        items: true,
      },
    });

    if (!pkg) {
      return this.sendReply(
        from,
        `❌ No package found with tracking code: ${code}`,
      );
    }

    const lines: string[] = [];
    lines.push(`📦 *Package: ${pkg.trackingCode}*`);
    lines.push(`Status: ${pkg.status} | ${pkg.shippingMode}`);
    lines.push(`Received: ${pkg.receivedDate.toLocaleDateString()}`);

    if (pkg.description) {
      lines.push('');
      lines.push(`Description: ${pkg.description}`);
    }

    if (pkg.warehouse) {
      lines.push('');
      lines.push(
        `Warehouse: ${pkg.warehouse.name}${pkg.warehouse.location ? ` (${pkg.warehouse.location})` : ''}`,
      );
    }

    if (pkg.pickupCode) {
      lines.push(`Pickup Code: ${pkg.pickupCode}`);
    }

    lines.push(`Payment: ${pkg.paymentStatus}`);

    if (pkg.packingList?.container) {
      const container = pkg.packingList.container;
      lines.push('');
      lines.push(`Packing List: ${pkg.packingList.name}`);
      lines.push(`Container: ${container.containerNumber}`);

      const departure = container.departureCity?.name || 'Unknown';
      const destination = container.destinationCity?.name || 'Unknown';
      lines.push(`Route: ${departure} → ${destination}`);

      if (container.eta) {
        lines.push(`ETA: ${container.eta.toLocaleDateString()}`);
      }
    }

    if (pkg.invoice) {
      lines.push('');
      lines.push(
        `Invoice: ${pkg.invoice.invoiceNumber} | ${pkg.invoice.currency} ${pkg.invoice.totalAmount} | ${pkg.invoice.status}`,
      );
      if (pkg.invoice.dueDate) {
        lines.push(`Due: ${pkg.invoice.dueDate.toLocaleDateString()}`);
      }
    }

    if (pkg.items.length > 0) {
      lines.push('');
      lines.push(`Items (${pkg.items.length}):`);
      for (const item of pkg.items) {
        const weight = item.weight ? ` ${item.weight}kg` : '';
        const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
        lines.push(
          `  • ${item.intakeTrackingCode}${qty}${weight} — ${item.description}`,
        );
      }
    }

    return this.sendReply(from, lines.join('\n'));
  }

  private async handlePhoneCommand(from: string, phone: string): Promise<void> {
    if (!phone) {
      return this.sendReply(
        from,
        'Please provide a phone number. Example:\nPHONE 0537776709',
      );
    }

    const packages = await this.prisma.package.findMany({
      where: {
        customer: {
          OR: [{ phoneNumber: phone }, { alternatePhone: phone }],
        },
        status: { not: 'RELEASED' },
        paymentStatus: 'PENDING',
      },
      include: { customer: true, warehouse: true },
      orderBy: { receivedDate: 'desc' },
      take: 20,
    });

    if (packages.length === 0) {
      return this.sendReply(
        from,
        `✅ No pending shipments found for ${phone}. If you have a tracking code, try:\nTRACK <code>`,
      );
    }

    const lines: string[] = [];
    lines.push(`📋 *Pending Shipments for ${phone}*`);
    lines.push('');

    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      lines.push(
        `${i + 1}. ${pkg.trackingCode} — ${pkg.status} — ${pkg.shippingMode} — ${pkg.receivedDate.toLocaleDateString()}`,
      );
      if (pkg.description) {
        lines.push(`   ${pkg.description}`);
      }
      lines.push(`   Payment: ${pkg.paymentStatus}`);
      lines.push('');
    }

    if (packages.length === 20) {
      lines.push('Showing top 20 results.');
    }

    return this.sendReply(from, lines.join('\n'));
  }

  private getHelpMessage(): string {
    return [
      'Welcome to AOSTP Logistics 🚚',
      '',
      'Commands:',
      'TRACK <code> — Track your shipment',
      'PHONE <number> — View pending shipments for a phone number',
      '',
      'Example:',
      'TRACK AOSTP-123',
      'PHONE 0537776709',
    ].join('\n');
  }

  private async sendReply(to: string, text: string): Promise<void> {
    if (!this.accessToken || !this.phoneNumberId) {
      this.logger.warn(
        `Cannot send reply to ${to}: WhatsApp credentials not configured`,
      );
      return;
    }

    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    };
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, { headers }),
      );
      this.logger.debug(
        `Reply sent to ${to} — Message ID: ${response.data?.messages?.[0]?.id || 'unknown'}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send reply to ${to}:`,
        error.response?.data || error.message,
      );
    }
  }
}
