import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { ChatbotHandler } from '../interfaces/chatbot-handler.interface';
import { ChatbotInput } from '../interfaces/chatbot-input.interface';
import { ChatbotResponse } from '../interfaces/chatbot-output.interface';

@Injectable()
export class TrackPackageHandler implements ChatbotHandler {
  readonly id = 'track-package';
  private readonly logger = new Logger(TrackPackageHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  canHandle(input: ChatbotInput): boolean {
    const upper = input.text.toUpperCase();
    const digitsOnly = input.text.replace(/\D/g, '');

    if (upper.startsWith('TRACK ')) {
      const rest = input.text.slice(6).trim();
      return rest.length > 0;
    }
    if (upper === 'TRACK') return false;

    if (upper.startsWith('INV')) return false;
    if (
      /[a-zA-Z]/.test(input.text) &&
      /\d/.test(input.text) &&
      input.text.length >= 5
    )
      return true;
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) return false;

    return false;
  }

  async handle(input: ChatbotInput): Promise<ChatbotResponse> {
    const upper = input.text.toUpperCase();
    let code: string;

    if (upper.startsWith('TRACK ')) {
      code = input.text.slice(6).trim();
    } else {
      code = input.text.trim();
    }

    if (!code) {
      return {
        type: 'text',
        text: '🔍 Please send your tracking code, invoice number, or intake code and I will look it up.\n\nExample: AOSTP-123',
      };
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
      return {
        type: 'text',
        text: '❌ No package found with that code. Please check and try again.',
      };
    }

    const sender = this.normalizePhone(input.from);
    const isOwner =
      this.normalizePhone(pkg.customer.phoneNumber) === sender ||
      (pkg.customer.alternatePhone != null &&
        this.normalizePhone(pkg.customer.alternatePhone) === sender);

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

    if (pkg.pickupCode && isOwner) {
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

    return { type: 'text', text: lines.join('\n') };
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) return '233' + digits.slice(1);
    if (digits.startsWith('233')) return digits;
    return digits;
  }
}
