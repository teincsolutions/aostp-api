import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { ChatbotHandler } from '../interfaces/chatbot-handler.interface';
import { ChatbotInput } from '../interfaces/chatbot-input.interface';
import { ChatbotResponse } from '../interfaces/chatbot-output.interface';

@Injectable()
export class InvoiceLookupHandler implements ChatbotHandler {
  readonly id = 'invoice-lookup';
  private readonly logger = new Logger(InvoiceLookupHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  canHandle(input: ChatbotInput): boolean {
    const upper = input.text.toUpperCase();

    if (upper.startsWith('INVOICE ')) {
      const rest = input.text.slice(8).trim();
      return rest.length > 0;
    }
    if (upper === 'INVOICE') return false;

    if (upper.startsWith('INV') && upper.length >= 4) return true;

    return false;
  }

  async handle(input: ChatbotInput): Promise<ChatbotResponse> {
    const upper = input.text.toUpperCase();
    let code: string;

    if (upper.startsWith('INVOICE ')) {
      code = input.text.slice(8).trim();
    } else {
      code = input.text.trim();
    }

    if (!code) {
      return {
        type: 'text',
        text: '📄 Please send an invoice number to look up.\n\nExample: INV-2026-001',
      };
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { invoiceNumber: code },
      include: {
        customer: {
          select: { firstName: true, lastName: true, phoneNumber: true },
        },
        package: {
          select: { trackingCode: true },
        },
        payments: {
          select: {
            amount: true,
            paymentMethod: true,
            reference: true,
            processedAt: true,
            gatewayStatus: true,
          },
          orderBy: { processedAt: 'desc' },
        },
      },
    });

    if (!invoice) {
      return {
        type: 'text',
        text: `❌ No invoice found with number: ${code}. Please check and try again.`,
      };
    }

    const customerName =
      `${invoice.customer?.firstName || ''} ${invoice.customer?.lastName || ''}`.trim();
    const statusEmoji =
      invoice.status === 'PAID'
        ? '✅'
        : invoice.status === 'PARTIALLY_PAID'
          ? '⚠️'
          : '❌';

    const lines: string[] = [];
    lines.push(`${statusEmoji} *Invoice: ${invoice.invoiceNumber}*`);
    lines.push(`Customer: ${customerName || invoice.customer?.phoneNumber}`);
    lines.push(
      `Status: ${invoice.status} | ${invoice.currency} ${invoice.totalAmount}`,
    );
    lines.push(`Paid: ${invoice.currency} ${invoice.paidAmount}`);
    lines.push(`Balance: ${invoice.currency} ${invoice.balance}`);
    lines.push(`Due: ${invoice.dueDate.toLocaleDateString()}`);

    if (invoice.package?.trackingCode) {
      lines.push(`Package: ${invoice.package.trackingCode}`);
    }

    if (invoice.payments.length > 0) {
      lines.push('');
      lines.push(`Payments (${invoice.payments.length}):`);
      for (const p of invoice.payments) {
        lines.push(
          `  • ${invoice.currency} ${p.amount} — ${p.paymentMethod}${p.reference ? ` (${p.reference})` : ''} — ${p.processedAt.toLocaleDateString()}`,
        );
      }
    }

    return { type: 'text', text: lines.join('\n') };
  }
}
