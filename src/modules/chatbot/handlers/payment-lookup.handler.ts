import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { ChatbotHandler } from '../interfaces/chatbot-handler.interface';
import { ChatbotInput } from '../interfaces/chatbot-input.interface';
import { ChatbotResponse } from '../interfaces/chatbot-output.interface';

@Injectable()
export class PaymentLookupHandler implements ChatbotHandler {
  readonly id = 'payment-lookup';
  private readonly logger = new Logger(PaymentLookupHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  canHandle(input: ChatbotInput): boolean {
    const upper = input.text.toUpperCase();

    if (upper.startsWith('PAYMENT ') || upper.startsWith('PAY ')) {
      const prefix = upper.startsWith('PAYMENT ') ? 'PAYMENT ' : 'PAY ';
      const rest = input.text.slice(prefix.length).trim();
      return rest.length > 0;
    }
    if (upper === 'PAYMENT' || upper === 'PAY') return false;

    return false;
  }

  async handle(input: ChatbotInput): Promise<ChatbotResponse> {
    const upper = input.text.toUpperCase();
    let code: string;

    if (upper.startsWith('PAYMENT ')) {
      code = input.text.slice(8).trim();
    } else if (upper.startsWith('PAY ')) {
      code = input.text.slice(4).trim();
    } else {
      code = input.text.trim();
    }

    if (!code) {
      return {
        type: 'text',
        text: '💳 Please send one or more invoice numbers to check payment status.\n\nExample: INV-2026-001 or INV-2026-001, INV-2026-002',
      };
    }

    const invoiceNumbers = code
      .split(/[,;]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    if (invoiceNumbers.length === 0) {
      return {
        type: 'text',
        text: '💳 Please send valid invoice numbers.\n\nExample: INV-2026-001 or INV-2026-001, INV-2026-002',
      };
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { invoiceNumber: { in: invoiceNumbers } },
      include: {
        customer: {
          select: { firstName: true, lastName: true },
        },
        payments: {
          select: {
            amount: true,
            paymentMethod: true,
            processedAt: true,
          },
          orderBy: { processedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (invoices.length === 0) {
      return {
        type: 'text',
        text: `❌ No invoices found for: ${invoiceNumbers.join(', ')}. Please check the numbers and try again.`,
      };
    }

    const sections: string[] = [];
    let grandTotalDue = 0;
    let grandCurrency = '';

    for (const inv of invoices) {
      const statusEmoji =
        inv.status === 'PAID'
          ? '✅'
          : inv.status === 'PARTIALLY_PAID'
            ? '⚠️'
            : '❌';
      grandCurrency = inv.currency;
      grandTotalDue += inv.balance;

      sections.push(
        `${statusEmoji} *${inv.invoiceNumber}* — ${inv.currency} ${inv.totalAmount}`,
      );
      sections.push(`   Status: ${inv.status}`);
      sections.push(`   Paid: ${inv.currency} ${inv.paidAmount}`);
      sections.push(`   Balance: ${inv.currency} ${inv.balance}`);
      sections.push(`   Due: ${inv.dueDate.toLocaleDateString()}`);

      if (inv.payments.length > 0) {
        for (const p of inv.payments) {
          sections.push(
            `   ↳ ${inv.currency} ${p.amount} via ${p.paymentMethod} on ${p.processedAt.toLocaleDateString()}`,
          );
        }
      }
      sections.push('');
    }

    if (invoices.length > 1) {
      sections.push(
        `---\nTotal Outstanding: ${grandCurrency} ${grandTotalDue}`,
      );
    }

    return { type: 'text', text: sections.join('\n').trim() };
  }
}
