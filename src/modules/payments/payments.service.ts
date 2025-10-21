import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Prisma, Payment, InvoiceStatus, PaymentStatus } from '@prisma/client';
import { PaymentStatus as GatewayPaymentStatus } from '../../providers/payment-gateway/payment-gateway.interface';
import { IdGeneratorService } from '../../shared/utils/id-generator.service';
import { PaymentGatewayService } from '../../providers/payment-gateway/payment-gateway.service';
import { PDFService } from '../../providers/pdf/pdf.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idGeneratorService: IdGeneratorService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly pdfService: PDFService,
  ) {}

  async create(
    createPaymentDto: CreatePaymentDto,
    userId: string,
  ): Promise<Payment> {
    const {
      customerId,
      amount,
      currency,
      exchangeRateId,
      paymentMethod,
      reference,
      invoiceIds,
      notes,
    } = createPaymentDto;

    // Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    // Verify exchange rate exists and is active
    const exchangeRate = await this.prisma.exchangeRate.findUnique({
      where: { id: exchangeRateId },
    });

    if (!exchangeRate) {
      throw new NotFoundException(
        `Exchange rate with ID ${exchangeRateId} not found`,
      );
    }

    if (!exchangeRate.isActive) {
      throw new BadRequestException('Selected exchange rate is not active');
    }

    // Verify invoices exist and belong to the customer
    let invoicesToPay: any[] = [];
    if (invoiceIds && invoiceIds.length > 0) {
      invoicesToPay = await this.prisma.invoice.findMany({
        where: {
          id: { in: invoiceIds },
          customerId,
          status: {
            in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID],
          },
        },
      });

      if (invoicesToPay.length !== invoiceIds.length) {
        throw new BadRequestException(
          'Some invoices not found or do not belong to the customer',
        );
      }

      // Check if invoices are already fully paid
      const fullyPaidInvoices = invoicesToPay.filter(
        (invoice) => invoice.status === InvoiceStatus.PAID,
      );

      if (fullyPaidInvoices.length > 0) {
        throw new BadRequestException(
          `Invoices ${fullyPaidInvoices
            .map((i: any) => i.invoiceNumber)
            .join(', ')} are already fully paid`,
        );
      }
    }

    // Calculate local amount using exchange rate
    const localAmount = amount * exchangeRate.rate;

    // Check if this is a gateway payment method
    const isGatewayPayment = paymentMethod === 'MOBILE_MONEY';

    // For gateway payments, process through gateway first but DON'T update invoices yet
    let gatewayResult: any = null;
    let paymentCode = await this.idGeneratorService.generateReceiptNumber();

    if (isGatewayPayment) {
      try {
        gatewayResult = await this.paymentGatewayService.processPayment(
          paymentMethod,
          {
            amount: localAmount,
            currency: 'GHS',
            customerEmail: customer.email || undefined,
            customerPhone: customer.phoneNumber,
            customerName: `${customer.firstName} ${customer.lastName}`,
            reference: paymentCode,
            description: `Payment for invoices: ${invoicesToPay.map((inv: any) => inv.invoiceNumber).join(', ')}`,
            metadata: {
              userId,
              customerCode: customer.customerCode,
              paymentMethod,
            },
          },
        );

        if (!gatewayResult.success) {
          throw new BadRequestException(
            `Gateway payment initiation failed: ${gatewayResult.errorMessage}`,
          );
        }

        // Use gateway transaction ID as payment code if available
        if (gatewayResult.gatewayTransactionId) {
          paymentCode = gatewayResult.gatewayTransactionId;
        }

        this.logger.log(
          `Gateway payment initiated: ${paymentCode} - Status: ${gatewayResult.status}`,
        );
      } catch (error) {
        this.logger.error(
          `Gateway payment initiation failed: ${error.message}`,
        );
        throw new BadRequestException(
          `Failed to initiate gateway payment: ${error.message}`,
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Prepare payment notes with gateway info for gateway payments
      let paymentNotes = notes;
      if (isGatewayPayment && gatewayResult) {
        const notesParts: string[] = [];
        if (notes) notesParts.push(notes);
        if (gatewayResult.paymentUrl) {
          notesParts.push(`GATEWAY PAYMENT URL: ${gatewayResult.paymentUrl}`);
        }
        notesParts.push(`GATEWAY STATUS: PENDING`);
        if (gatewayResult.gatewayTransactionId) {
          notesParts.push(
            `GATEWAY TRANSACTION ID: ${gatewayResult.gatewayTransactionId}`,
          );
        }
        paymentNotes = notesParts.join('\n');
      }

      // Create payment
      const payment = await tx.payment.create({
        data: {
          paymentCode,
          customer: {
            connect: { id: customerId },
          },
          amount,
          currency,
          exchangeRate: {
            connect: { id: exchangeRateId },
          },
          localAmount,
          paymentMethod,
          reference,
          notes: paymentNotes,
          processedBy: {
            connect: { id: userId },
          },
        },
        include: {
          customer: true,
          exchangeRate: true,
          processedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // For gateway payments, link to invoices but DON'T update their status yet
      // The actual payment application happens on successful callback
      if (isGatewayPayment && invoiceIds && invoiceIds.length > 0) {
        // Store intended invoice IDs in notes for later processing
        const updatedNotes = payment.notes
          ? `${payment.notes}\nINTENDED INVOICES: ${invoiceIds.join(',')}`
          : `INTENDED INVOICES: ${invoiceIds.join(',')}`;

        await tx.payment.update({
          where: { id: payment.id },
          data: { notes: updatedNotes },
        });
      }
      // For non-gateway payments, apply payment immediately as before
      else if (!isGatewayPayment && invoiceIds && invoiceIds.length > 0) {
        // Create payment-invoice relationships
        await tx.$executeRaw`
          INSERT INTO "_InvoiceToPayment" ("A", "B")
          SELECT unnest(${invoiceIds}::text[]) as "A", ${payment.id} as "B"
        `;

        // Update invoice paid amounts and status
        let remainingAmount = amount;
        for (const invoice of invoicesToPay) {
          const outstandingAmount = invoice.totalAmount - invoice.paidAmount;
          const paymentAmount = Math.min(remainingAmount, outstandingAmount);

          const newPaidAmount = invoice.paidAmount + paymentAmount;
          const newBalance = invoice.totalAmount - newPaidAmount;
          const newStatus =
            newPaidAmount >= invoice.totalAmount
              ? InvoiceStatus.PAID
              : newPaidAmount > invoice.paidAmount
                ? InvoiceStatus.PARTIALLY_PAID
                : invoice.status;

          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              paidAmount: newPaidAmount,
              balance: newBalance,
              status: newStatus,
            },
          });

          // Update package payment status if invoice is fully paid
          if (newStatus === InvoiceStatus.PAID) {
            await tx.package.updateMany({
              where: { id: invoice.packageId || '' },
              data: { paymentStatus: PaymentStatus.PAID },
            });
          } else if (newPaidAmount > 0) {
            await tx.package.updateMany({
              where: { id: invoice.packageId || '' },
              data: { paymentStatus: PaymentStatus.PARTIAL },
            });
          }

          remainingAmount -= paymentAmount;
          if (remainingAmount <= 0) break;
        }
      }

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entity: 'Payment',
          entityId: payment.id,
          after: payment as any,
          metadata: {
            customerCode: customer.customerCode,
            invoiceCount: invoiceIds ? invoiceIds.length : 0,
            localAmount,
            paymentMethod,
            isGatewayPayment,
          },
        },
      });

      return payment;
    });

    this.logger.log(
      `Payment ${paymentCode} processed for customer ${customer.customerCode} - Amount: ${amount} ${currency}`,
    );

    return result;
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      customerId?: string;
      paymentMethod?: string;
      dateFrom?: string;
      dateTo?: string;
      currency?: string;
    },
  ) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {};

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters?.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    if (filters?.currency) {
      where.currency = filters.currency;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.processedAt = {};
      if (filters.dateFrom) {
        where.processedAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.processedAt.lte = new Date(filters.dateTo);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: true,
          exchangeRate: {
            select: {
              rate: true,
              fromCurrency: true,
              toCurrency: true,
            },
          },
          processedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          invoices: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              currency: true,
            },
          },
        },
        orderBy: { processedAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        customer: true,
        exchangeRate: true,
        processedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paidAmount: true,
            balance: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async findByCode(paymentCode: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { paymentCode },
      include: {
        customer: true,
        exchangeRate: true,
        processedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paidAmount: true,
            balance: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with code ${paymentCode} not found`);
    }

    return payment;
  }

  async update(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
    userId: string,
  ): Promise<Payment> {
    const existingPayment = await this.findOne(id);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: updatePaymentDto,
        include: {
          customer: true,
          exchangeRate: true,
          processedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          invoices: true,
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'Payment',
          entityId: id,
          before: existingPayment as any,
          after: updatedPayment as any,
        },
      });

      return updatedPayment;
    });

    this.logger.log(`Payment ${result.paymentCode} updated`);
    return result;
  }

  async getCustomerPayments(customerId: string, paginationDto: PaginationDto) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { customerId },
        skip,
        take: limit,
        include: {
          exchangeRate: {
            select: {
              rate: true,
              fromCurrency: true,
              toCurrency: true,
            },
          },
          invoices: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              currency: true,
            },
          },
        },
        orderBy: { processedAt: 'desc' },
      }),
      this.prisma.payment.count({ where: { customerId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentStats(filters?: {
    dateFrom?: string;
    dateTo?: string;
    customerId?: string;
  }) {
    const where: Prisma.PaymentWhereInput = {};

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.processedAt = {};
      if (filters.dateFrom) {
        where.processedAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.processedAt.lte = new Date(filters.dateTo);
      }
    }

    const [totalStats, methodStats, currencyStats] = await Promise.all([
      // Total payments and amount
      this.prisma.payment.aggregate({
        where,
        _count: { id: true },
        _sum: { amount: true, localAmount: true },
        _avg: { amount: true },
      }),

      // By payment method
      this.prisma.payment.groupBy({
        by: ['paymentMethod'],
        where,
        _count: { id: true },
        _sum: { amount: true, localAmount: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // By currency
      this.prisma.payment.groupBy({
        by: ['currency'],
        where,
        _count: { id: true },
        _sum: { amount: true, localAmount: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),
    ]);

    return {
      totals: {
        count: totalStats._count.id,
        totalAmount: totalStats._sum.amount || 0,
        totalLocalAmount: totalStats._sum.localAmount || 0,
        averageAmount: totalStats._avg.amount || 0,
      },
      byPaymentMethod: methodStats,
      byCurrency: currencyStats,
    };
  }

  // TODO: Implement refund functionality
  // This would require proper integration with payment gateways
  // and more complex business logic for handling refunds
  // Automated reconciliation for payments
  async reconcilePayments(dateFrom?: Date, dateTo?: Date) {
    const where: any = {
      processedAt: {
        gte: dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        lte: dateTo || new Date(),
      },
    };

    // Find all payments in the period
    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        customer: true,
        exchangeRate: true,
        invoices: {
          include: {
            package: true, // Include package relation
          },
        },
      },
      orderBy: { processedAt: 'desc' },
    });

    this.logger.log(`Starting reconciliation for ${payments.length} payments`);

    const reconciliationResults = {
      totalPayments: payments.length,
      totalAmount: 0,
      reconciledPayments: 0,
      discrepancies: [] as any[],
    };

    for (const payment of payments) {
      reconciliationResults.totalAmount += payment.amount;

      // Basic reconciliation checks
      const checks = await this.performReconciliationChecks(payment);

      if (checks.hasDiscrepancy) {
        reconciliationResults.discrepancies.push({
          paymentId: payment.id,
          paymentCode: payment.paymentCode,
          customerCode: payment.customer?.customerCode,
          amount: payment.amount,
          issues: checks.discrepancies,
        });
      } else {
        reconciliationResults.reconciledPayments++;

        // Mark as reconciled if needed
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            notes: payment.notes
              ? `${payment.notes}\nAUTO RECONCILED on ${new Date().toISOString()}`
              : `AUTO RECONCILED on ${new Date().toISOString()}`,
          },
        });
      }
    }

    // Log reconciliation summary
    await this.prisma.auditLog.create({
      data: {
        action: 'SYSTEM_RECONCILIATION',
        entity: 'Payment',
        entityId: 'SYSTEM', // Use a system-level identifier
        metadata: {
          period: {
            from: dateFrom?.toISOString(),
            to: dateTo?.toISOString(),
          },
          results: reconciliationResults,
        },
      },
    });

    this.logger.log(
      `Reconciliation completed: ${reconciliationResults.reconciledPayments}/${reconciliationResults.totalPayments} payments reconciled`,
    );

    return reconciliationResults;
  }

  private async performReconciliationChecks(payment: any) {
    const discrepancies: string[] = [];

    // Check 1: Exchange rate consistency
    if (payment.amount > 0 && payment.localAmount === 0) {
      discrepancies.push('Local amount not calculated from exchange rate');
    }

    // Check 2: Invoice payment linkage
    if (payment.invoices.length === 0) {
      discrepancies.push('No associated invoices found');
    }

    // Check 3: Payment method validation (using gateway)
    try {
      const gatewayStatus = await this.paymentGatewayService.getPaymentStatus(
        payment.paymentMethod,
        payment.paymentCode, // Assuming paymentCode is used as gateway reference
      );

      // Add any gateway validation errors
      if (gatewayStatus === GatewayPaymentStatus.FAILED) {
        discrepancies.push('Gateway status indicates failed payment');
      }
    } catch (error) {
      discrepancies.push(`Gateway validation failed: ${error.message}`);
    }

    // Check 4: Amount consistency with linked invoices
    if (payment.invoices.length > 0) {
      const totalInvoiceAmount = payment.invoices.reduce(
        (sum: number, inv: any) => sum + inv.totalAmount,
        0,
      );

      if (Math.abs(totalInvoiceAmount - payment.amount) > 0.01) {
        discrepancies.push(
          `Invoice total (${totalInvoiceAmount}) doesn't match payment amount (${payment.amount})`,
        );
      }
    }

    return {
      hasDiscrepancy: discrepancies.length > 0,
      discrepancies,
    };
  }

  // Legacy refund method with gateway integration
  async processRefund(
    paymentId: string,
    refundAmount: number,
    reason: string,
    userId: string,
  ) {
    const payment = await this.findOne(paymentId);

    if (refundAmount > payment.amount) {
      throw new BadRequestException(
        'Refund amount cannot exceed payment amount',
      );
    }

    // Process refund via payment gateway
    try {
      const refundResult = await this.paymentGatewayService.processRefund(
        payment.paymentMethod,
        payment.paymentCode,
        refundAmount,
        reason,
      );

      if (!refundResult.success) {
        throw new BadRequestException(
          `Refund failed: ${refundResult.errorMessage}`,
        );
      }

      // Log successful refund
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'REFUND_COMPLETED',
          entity: 'Payment',
          entityId: payment.id,
          metadata: {
            refundAmount,
            reason,
            originalAmount: payment.amount,
            refundId: refundResult.refundId,
          },
        },
      });

      this.logger.log(
        `Refund processed for payment ${payment.paymentCode} - Amount: ${refundAmount} ${payment.currency}`,
      );

      return {
        success: true,
        refundAmount,
        refundId: refundResult.refundId,
        paymentCode: payment.paymentCode,
      };
    } catch (error) {
      // Log failed refund attempt
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'REFUND_FAILED',
          entity: 'Payment',
          entityId: payment.id,
          metadata: {
            refundAmount,
            reason,
            error: error.message,
          },
        },
      });

      throw error;
    }
  }

  /**
   * Process Hubtel callback when payment status is received from hubtel
   */
  async processHubtelCallback(
    callbackData: any,
  ): Promise<{ status: 'success' | 'failed' }> {
    try {
      this.logger.log(
        `Processing Hubtel callback: ${JSON.stringify(callbackData)}`,
      );

      // Validate callback data matches the expected structure from docs
      const { Status, Data } = callbackData;

      if (Status === 'Successful') {
        await this.processHubtelSuccessCallback(Data);
        return { status: 'success' };
      } else if (Status === 'Failed') {
        await this.processHubtelFailedCallback(Data);
        return { status: 'success' }; // Returned success even on failure (hubtel ping received)
      }

      this.logger.warn(`Unknown Hubtel callback status: ${Status}`);
      return { status: 'success' }; // Acknowledge receipt regardless
    } catch (error) {
      this.logger.error(
        `Hubtel callback processing failed: ${error.message}`,
        error.stack,
      );
      return { status: 'failed' };
    }
  }

  private async processHubtelSuccessCallback(data: any): Promise<void> {
    const { CheckoutId, ReceiptNumber } = data;

    // Find payment by CheckoutId (which should be paymentCode)
    const payment = await this.prisma.payment.findUnique({
      where: { paymentCode: CheckoutId },
      include: {
        invoices: true,
        customer: true,
      },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for CheckoutId: ${CheckoutId}`);
      return;
    }

    if (payment.paymentMethod !== 'MOBILE_MONEY') {
      this.logger.warn(`Payment ${CheckoutId} is not a mobile money payment`);
      return;
    }

    // Extract intended invoice IDs from notes
    const notesLines = payment.notes?.split('\n') || [];
    const intendedInvoicesLine = notesLines.find((line) =>
      line.startsWith('INTENDED INVOICES:'),
    );
    const invoiceIds =
      intendedInvoicesLine
        ?.replace('INTENDED INVOICES:', '')
        .trim()
        .split(',')
        .map((id) => id.trim()) || [];

    if (invoiceIds.length === 0) {
      this.logger.warn(`No intended invoices found for payment ${CheckoutId}`);
      return;
    }

    // Verify invoices still exist and belong to customer
    const invoicesToPay = await this.prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        customerId: payment.customerId,
        status: {
          in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID],
        },
      },
    });

    if (invoicesToPay.length === 0) {
      this.logger.warn(`No valid invoices found for payment ${CheckoutId}`);
      return;
    }

    // Apply the payment to invoices (similar to the create method logic)
    await this.prisma.$transaction(async (tx) => {
      // Create payment-invoice relationships
      await tx.$executeRaw`
        INSERT INTO "_InvoiceToPayment" ("A", "B")
        SELECT unnest(${invoiceIds}::text[]) as "A", ${payment.id} as "B"
      `;

      // Update invoice paid amounts and status
      let remainingAmount = payment.amount;
      for (const invoice of invoicesToPay) {
        const outstandingAmount = invoice.totalAmount - invoice.paidAmount;
        const paymentAmount = Math.min(remainingAmount, outstandingAmount);

        const newPaidAmount = invoice.paidAmount + paymentAmount;
        const newBalance = invoice.totalAmount - newPaidAmount;
        const newStatus =
          newPaidAmount >= invoice.totalAmount
            ? InvoiceStatus.PAID
            : newPaidAmount > invoice.paidAmount
              ? InvoiceStatus.PARTIALLY_PAID
              : invoice.status;

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaidAmount,
            balance: newBalance,
            status: newStatus,
          },
        });

        // Update package payment status if invoice is fully paid
        if (newStatus === InvoiceStatus.PAID) {
          await tx.package.updateMany({
            where: { id: invoice.packageId || '' },
            data: { paymentStatus: PaymentStatus.PAID },
          });
        } else if (newPaidAmount > 0) {
          await tx.package.updateMany({
            where: { id: invoice.packageId || '' },
            data: { paymentStatus: PaymentStatus.PARTIAL },
          });
        }

        remainingAmount -= paymentAmount;
        if (remainingAmount <= 0) break;
      }

      // Update payment notes with success information and completed status
      const updatedNotes = payment.notes
        ? `${payment.notes}\nGATEWAY STATUS: COMPLETED\nHUBTEL SUCCESS RECEIPT: ${ReceiptNumber}`
        : `GATEWAY STATUS: COMPLETED\nHUBTEL SUCCESS RECEIPT: ${ReceiptNumber}`;

      await tx.payment.update({
        where: { id: payment.id },
        data: { notes: updatedNotes },
      });
    });

    this.logger.log(
      `Hubtel success callback processed for payment ${CheckoutId}: ${ReceiptNumber}`,
    );
  }

  private async processHubtelFailedCallback(data: any): Promise<void> {
    const { CheckoutId, Description } = data;

    // Find payment by CheckoutId (which should be paymentCode)
    const payment = await this.prisma.payment.findUnique({
      where: { paymentCode: CheckoutId },
      include: {
        invoices: true,
        customer: true,
      },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for CheckoutId: ${CheckoutId}`);
      return;
    }

    if (payment.paymentMethod !== 'MOBILE_MONEY') {
      this.logger.warn(`Payment ${CheckoutId} is not a mobile money payment`);
      return;
    }

    // Update payment notes with failure information
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        notes: payment.notes
          ? `${payment.notes}\nGATEWAY STATUS: FAILED\nHUBTEL FAILED: ${Description}`
          : `GATEWAY STATUS: FAILED\nHUBTEL FAILED: ${Description}`,
      },
    });

    this.logger.log(
      `Hubtel failed callback processed for payment ${CheckoutId}: ${Description}`,
    );
  }

  /**
   * Generate payment receipt PDF synchronously
   */
  async generatePaymentReceipt(
    paymentId: string,
  ): Promise<{ url: string; key: string }> {
    // Get payment with includes directly to avoid type issues
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        customer: true,
        exchangeRate: true,
        processedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paidAmount: true,
            balance: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    // Prepare receipt data with payment information
    const receiptData = {
      receipt: {
        number: payment.paymentCode,
        date: payment.processedAt.toLocaleDateString(),
        paymentMethod: payment.paymentMethod,
      },
      customer: {
        code: payment.customer.customerCode,
        name: `${payment.customer.firstName} ${payment.customer.lastName}`,
        phone: payment.customer.phoneNumber,
        email: payment.customer.email || undefined,
      },
      payment: {
        amount: payment.amount,
        currency: payment.currency,
        reference: payment.reference || undefined,
      },
      invoices: payment.invoices.map((inv) => ({
        number: inv.invoiceNumber,
        total: inv.totalAmount,
        paid: inv.paidAmount,
        balance: inv.balance,
      })),
      notes: payment.notes ? `Payment Notes: ${payment.notes}` : undefined,
    };

    const result = await this.pdfService.generateReceiptPDF(receiptData);

    this.logger.log(
      `Payment receipt generated for ${payment.paymentCode}: ${result.key}`,
    );

    return result;
  }
}
