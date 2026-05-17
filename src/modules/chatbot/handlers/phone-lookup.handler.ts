import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { ChatbotHandler } from '../interfaces/chatbot-handler.interface';
import { ChatbotInput } from '../interfaces/chatbot-input.interface';
import { ChatbotResponse } from '../interfaces/chatbot-output.interface';

@Injectable()
export class PhoneLookupHandler implements ChatbotHandler {
  readonly id = 'phone-lookup';
  private readonly logger = new Logger(PhoneLookupHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  canHandle(input: ChatbotInput): boolean {
    const upper = input.text.toUpperCase();
    const digitsOnly = input.text.replace(/\D/g, '');

    if (upper.startsWith('PHONE ')) {
      const rest = input.text.slice(6).trim();
      return rest.length > 0;
    }
    if (upper === 'PHONE') return false;

    if (
      /[a-zA-Z]/.test(input.text) &&
      /\d/.test(input.text) &&
      input.text.length >= 5
    )
      return false;
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) return true;

    return false;
  }

  async handle(input: ChatbotInput): Promise<ChatbotResponse> {
    const upper = input.text.toUpperCase();
    let phone: string;

    if (upper.startsWith('PHONE ')) {
      phone = input.text.slice(6).trim();
    } else {
      phone = input.text.trim();
    }

    if (!phone) {
      return {
        type: 'text',
        text: '📋 Please send your phone number so I can find your pending shipments.\n\nExample: 0537776709',
      };
    }

    const normalized = this.normalizePhone(phone);
    const last9 = normalized.slice(-9);

    const packages = await this.prisma.package.findMany({
      where: {
        customer: {
          OR: [
            { phoneNumber: { endsWith: last9 } },
            { alternatePhone: { endsWith: last9 } },
          ],
        },
        status: { not: 'RELEASED' },
        paymentStatus: 'PENDING',
      },
      include: { customer: true, warehouse: true },
      orderBy: { receivedDate: 'desc' },
      take: 20,
    });

    if (packages.length === 0) {
      return {
        type: 'text',
        text: '✅ No pending shipments found for this number. If you have a tracking code, send it and I will look it up.',
      };
    }

    const lines: string[] = [];
    lines.push(`📋 *Pending Shipments*`);
    lines.push('');

    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      lines.push(
        `${i + 1}. ${pkg.trackingCode} — ${pkg.status} — ${pkg.shippingMode} — ${pkg.receivedDate.toLocaleDateString()}`,
      );
      if (pkg.description) {
        lines.push(`   ${pkg.description}`);
      }
      lines.push('');
    }

    if (packages.length === 20) {
      lines.push('Showing top 20 results.');
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
