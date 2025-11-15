import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Prisma, Payment, InvoiceStatus, PaymentStatus } from '@prisma/client';
import {
  PaymentStatus as GatewayPaymentStatus,
  PaymentResult,
} from '../../providers/payment-gateway/payment-gateway.interface';
import { IdGeneratorService } from '../../shared/utils/id-generator.service';
import { PaymentGatewayService } from '../../providers/payment-gateway/payment-gateway.service';
import { PDFService } from '../../providers/pdf/pdf.service';
import { CallbackTokenService } from 'src/providers/payment-gateway/callback-token.service';
import { HubtelCallbackData } from 'src/providers/payment-gateway/providers/hubtel.provider';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idGeneratorService: IdGeneratorService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly callbackTokenService: CallbackTokenService,
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
    // Only convert if payment currency is different from GHS
    const localAmount =
      currency === 'GHS' ? amount : amount * exchangeRate.rate;

    // Check if this is a gateway payment method
    const isGatewayPayment =
      paymentMethod === 'MOBILE_MONEY' || paymentMethod === 'CARD';

    // For gateway payments, process through gateway first but DON'T update invoices yet
    let gatewayResult: PaymentResult | null = null;
    let gatewayTransactionId: string | null = null;

    const paymentCode = await this.idGeneratorService.generateReceiptNumber();

    if (isGatewayPayment) {
      try {
        // Generate signed callback token for security
        const callbackToken = this.callbackTokenService.generateCallbackToken({
          paymentCode,
        });

        // Process payment through gateway with signed callback token
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
            callbackToken: callbackToken,
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
        if (gatewayResult.gatewayTransactionId)
          gatewayTransactionId = gatewayResult.gatewayTransactionId;

        this.logger.log(
          `Gateway payment initiated: ${paymentCode} - Status: ${gatewayResult.status} - Callback token generated`,
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
          gatewayTransactionId,
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
          gatewayStatus: isGatewayPayment
            ? GatewayPaymentStatus.PENDING
            : undefined,
          processedBy: {
            connect: { id: userId },
          },
          invoices: {
            connect: invoiceIds ? invoiceIds.map((id) => ({ id })) : [],
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

      // For non-gateway payments, apply payment to invoices immediately
      if (invoiceIds && invoiceIds.length > 0 && !isGatewayPayment) {
        // Apply payment to invoices - create relationship and update amounts
        await this.applyPaymentToInvoices(
          tx,
          payment.id,
          invoiceIds,
          amount,
          invoicesToPay,
          currency,
        );
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

    // Generate receipt for cash payments immediately
    if (!isGatewayPayment) {
      try {
        const receiptResult = await this.generatePaymentReceipt(result.id);
        this.logger.log(
          `Payment receipt generated for cash payment ${paymentCode}: ${receiptResult.key}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate receipt for cash payment ${paymentCode}: ${error.message}`,
        );
        // Don't fail the payment creation if receipt generation fails
      }
    }

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
        select: {
          id: true,
          paymentCode: true,
          customerId: true,
          amount: true,
          currency: true,
          exchangeRateId: true,
          localAmount: true,
          paymentMethod: true,
          reference: true,
          notes: true,
          processedById: true,
          processedAt: true,
          createdAt: true,
          gatewayTransactionId: true,
          gatewayStatus: true,
          receiptKey: true,
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
              balance: true,
              localAmount: true,
              status: true,
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
            localAmount: true,
            status: true,
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
      select: {
        id: true,
        paymentCode: true,
        customerId: true,
        amount: true,
        currency: true,
        exchangeRateId: true,
        localAmount: true,
        paymentMethod: true,
        reference: true,
        notes: true,
        processedById: true,
        processedAt: true,
        createdAt: true,
        gatewayTransactionId: true,
        gatewayStatus: true,
        receiptKey: true,
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
            localAmount: true,
            status: true,
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
              balance: true,
              localAmount: true,
              status: true,
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

  /**
   * Helper method to apply payment to invoices
   * Distributes payment amount across specified invoices with currency conversion
   */
  private async applyPaymentToInvoices(
    tx: Prisma.TransactionClient,
    paymentId: string,
    invoiceIds: string[],
    paymentAmount: number,
    invoicesToPay: any[],
    paymentCurrency: string,
  ): Promise<void> {
    // Get the payment with exchange rate for currency conversion
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { exchangeRate: true },
    });

    if (!payment) {
      throw new BadRequestException(`Payment with ID ${paymentId} not found`);
    }

    // Note: Payment-invoice relationships are already created via the connect in payment creation
    // Update invoice paid amounts and status
    // remainingAmount is tracked in payment currency
    let remainingAmount = paymentAmount;

    for (const invoice of invoicesToPay) {
      // Convert outstanding invoice amount to payment currency for comparison
      const outstandingAmountInPaymentCurrency = this.convertAmountToCurrency(
        invoice.totalAmount - invoice.paidAmount,
        invoice.currency,
        paymentCurrency,
        payment.exchangeRate,
      );

      // Calculate how much to apply in payment currency
      const amountToApplyInPaymentCurrency = Math.min(
        remainingAmount,
        outstandingAmountInPaymentCurrency,
      );

      // Convert the amount to apply back to invoice currency
      const amountToApplyInInvoiceCurrency = this.convertAmountToCurrency(
        amountToApplyInPaymentCurrency,
        paymentCurrency,
        invoice.currency,
        payment.exchangeRate,
      );

      const newPaidAmount = invoice.paidAmount + amountToApplyInInvoiceCurrency;
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

      // Reduce remaining amount in payment currency
      remainingAmount -= amountToApplyInPaymentCurrency;
      if (remainingAmount <= 0) break;
    }
  }

  /**
   * Helper method to convert amount between currencies using exchange rate
   */
  private convertAmountToCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    exchangeRate: any,
  ): number {
    // If currencies are the same, no conversion needed
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // Use the exchange rate to convert
    // The exchange rate represents how many toCurrency units = 1 fromCurrency unit
    if (
      exchangeRate.fromCurrency === fromCurrency &&
      exchangeRate.toCurrency === toCurrency
    ) {
      return amount * exchangeRate.rate;
    } else if (
      exchangeRate.fromCurrency === toCurrency &&
      exchangeRate.toCurrency === fromCurrency
    ) {
      return amount / exchangeRate.rate;
    } else {
      // If the exchange rate doesn't match the conversion direction, we need to handle it
      // For now, assume the rate is stored as fromCurrency to toCurrency
      // This might need adjustment based on how exchange rates are stored
      this.logger.warn(
        `Exchange rate direction mismatch: trying to convert ${fromCurrency} to ${toCurrency} but rate is ${exchangeRate.fromCurrency} to ${exchangeRate.toCurrency}`,
      );
      return amount * exchangeRate.rate;
    }
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

  /**
   * Generic payment callback processor that works with any payment provider
   * Uses flexible lookup strategies to find payments based on callback data
   */
  async processPaymentCallback(
    paymentMethod: string,
    callbackData: any,
  ): Promise<{ status: 'success' | 'failed' }> {
    try {
      this.logger.log(
        `Processing ${paymentMethod} callback: ${JSON.stringify(callbackData)}`,
      );

      // Extract relevant fields from callback data - provider agnostic
      const extractedData = this.extractPaymentCallbackData(callbackData);

      if (extractedData.status === 'success') {
        await this.processPaymentSuccessCallback(paymentMethod, extractedData);
        return { status: 'success' };
      } else if (extractedData.status === 'failed') {
        await this.processPaymentFailedCallback(paymentMethod, extractedData);
        return { status: 'success' }; // Still acknowledge receipt
      }

      this.logger.warn(
        `Unknown callback status for ${paymentMethod}: ${extractedData.status}`,
      );
      return { status: 'success' };
    } catch (error) {
      this.logger.error(
        `${paymentMethod} callback processing failed: ${error.message}`,
        error.stack,
      );
      return { status: 'failed' };
    }
  }

  /**
   * Extract payment callback data in a provider-agnostic way
   * Maps various callback formats to a standardized interface
   */
  private extractPaymentCallbackData(callbackData: HubtelCallbackData): {
    status: 'success' | 'failed' | 'unknown';
    transactionId?: string;
    clientReference?: string;
    amount?: number;
    description?: string;
    receiptNumber?: string;
    additionalData?: any;
  } {
    // Handle Hubtel callback format
    if (callbackData.ResponseCode !== undefined) {
      const { ResponseCode, Data } = callbackData;
      if (ResponseCode === '0000') {
        return {
          status: 'success',
          transactionId: Data.InvoiceId,
          amount: Data.AmountPaid,
          description: Data.Description,
          receiptNumber: Data.ReceiptNumber,
          additionalData: Data,
        };
      } else if (ResponseCode == '0001') {
        return {
          status: 'failed',
          transactionId: Data.InvoiceId,
          description: Data?.Description,
          additionalData: Data,
        };
      }
    }

    return {
      status: 'unknown',
      additionalData: callbackData,
    };
  }

  /**
   * Find payment using flexible lookup strategies
   * Tries multiple fields to locate the payment regardless of provider structure
   */
  private async findPaymentByCallbackData(data: {
    transactionId?: string;
    clientReference?: string;
  }): Promise<any> {
    // Try lookup strategies in order of preference

    // 1. By client reference (our internal payment code)
    if (data.clientReference) {
      const payment = await this.prisma.payment.findUnique({
        where: { paymentCode: data.clientReference },
        include: { invoices: true, customer: true },
      });
      if (payment) return payment;
    }

    // 2. By transactionId (could be either paymentCode or stored gatewayTransactionId)
    if (data.transactionId) {
      const payment = await this.prisma.payment.findFirst({
        where: { gatewayTransactionId: data.transactionId },
        include: { invoices: true, customer: true },
      });
      if (payment) return payment;

      // Try finding by gatewayTransactionId (fallback to multiple results)
      const payments = await this.prisma.payment.findMany({
        where: { gatewayTransactionId: data.transactionId },
        include: { invoices: true, customer: true },
      });
      if (payments.length > 0) return payments[0];
    }

    return null;
  }

  private async processPaymentSuccessCallback(
    paymentMethod: string,
    data: any,
  ): Promise<void> {
    // Find payment using flexible lookup
    const payment = await this.findPaymentByCallbackData(data);

    if (!payment) {
      this.logger.warn(
        `Payment not found for callback data: ${JSON.stringify(data)}`,
      );
      return;
    }

    if (payment.paymentMethod !== paymentMethod) {
      this.logger.warn(
        `Payment ${payment.paymentCode} method mismatch: expected ${paymentMethod}, got ${payment.paymentMethod}`,
      );
      return; // Allow different payment methods to be processed
    }

    // Log successful payment completion
    this.logger.log(
      `${paymentMethod} payment succeeded - ID: ${payment.paymentCode}, Gateway TXN: ${payment.gatewayTransactionId}, Amount: ${data.amount}`,
    );

    // Apply payment to invoices and update gateway status
    await this.prisma.$transaction(async (tx) => {
      // Prepare update data
      const updateData: any = {};

      // Update gateway transaction ID if not already stored
      if (!payment.gatewayTransactionId && data.transactionId) {
        updateData.gatewayTransactionId = data.transactionId;
      }

      // Update gateway status
      updateData.gatewayStatus = GatewayPaymentStatus.COMPLETED;

      // Update payment notes with success information
      const successNotes = [
        `GATEWAY STATUS: COMPLETED`,
        data.receiptNumber
          ? `${paymentMethod.toUpperCase()} RECEIPT: ${data.receiptNumber}`
          : null,
        data.clientReference
          ? `CLIENT REFERENCE: ${data.clientReference}`
          : null,
        data.description ? `DESCRIPTION: ${data.description}` : null,
        data.transactionId
          ? `GATEWAY TRANSACTION ID: ${data.transactionId}`
          : null,
      ]
        .filter(Boolean)
        .join('\n');

      // Replace the "Gateway Payment - Pending settlement" with success notes
      updateData.notes = payment.notes
        ? payment.notes.replace(
            'GATEWAY PAYMENT - Pending settlement',
            successNotes,
          )
        : successNotes;

      if (Object.keys(updateData).length > 0) {
        await tx.payment.update({
          where: { id: payment.id },
          data: updateData,
        });
      }

      // Apply payment to invoices now that payment is confirmed
      if (payment.invoices && payment.invoices.length > 0) {
        const invoiceIds = payment.invoices.map((inv: any) => inv.id);
        await this.applyPaymentToInvoices(
          tx,
          payment.id,
          invoiceIds,
          payment.amount,
          payment.invoices,
          payment.currency,
        );
      }
    });

    // Generate receipt for successful gateway payment
    try {
      const receiptResult = await this.generatePaymentReceipt(payment.id);
      this.logger.log(
        `Payment receipt generated for successful gateway payment ${payment.paymentCode}: ${receiptResult.key}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate receipt for successful gateway payment ${payment.paymentCode}: ${error.message}`,
      );
      // Don't fail the callback processing if receipt generation fails
    }

    this.logger.log(
      `${paymentMethod} success callback processed for payment ${payment.paymentCode}`,
    );
  }

  private async processPaymentFailedCallback(
    paymentMethod: string,
    data: any,
  ): Promise<void> {
    // Find payment using flexible lookup
    const payment = await this.findPaymentByCallbackData(data);

    if (!payment) {
      this.logger.warn(
        `Payment not found for failed callback data: ${JSON.stringify(data)}`,
      );
      return;
    }

    if (payment.paymentMethod !== paymentMethod) {
      this.logger.warn(
        `Payment ${payment.paymentCode} method mismatch: expected ${paymentMethod}, got ${payment.paymentMethod}`,
      );
      return;
    }

    // Log failed payment
    this.logger.log(
      `${paymentMethod} payment failed - ID: ${payment.paymentCode}, Reason: ${data.description}`,
    );

    // Update payment with failure information
    const failureNotes = [
      `GATEWAY STATUS: FAILED`,
      data.description
        ? `${paymentMethod.toUpperCase()} FAILED: ${data.description}`
        : `Payment failed`,
      data.clientReference ? `CLIENT REFERENCE: ${data.clientReference}` : null,
      data.transactionId ? `TRANSACTION ID: ${data.transactionId}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const updateData: any = {
      notes: payment.notes ? `${payment.notes}\n${failureNotes}` : failureNotes,
    };

    // Update gateway status if tracking it
    if (payment.gatewayStatus !== GatewayPaymentStatus.FAILED) {
      updateData.gatewayStatus = GatewayPaymentStatus.FAILED;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: updateData,
    });

    this.logger.log(
      `${paymentMethod} failed callback processed for payment ${payment.paymentCode}: ${data.description}`,
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

    // Validate that payment has required data
    if (!payment.customer) {
      throw new BadRequestException('Payment must have associated customer');
    }

    if (!payment.invoices || payment.invoices.length === 0) {
      throw new BadRequestException('Payment must have associated invoices');
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

    // Store the receipt key in the payment record
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { receiptKey: result.key },
    });

    this.logger.log(
      `Payment receipt generated for ${payment.paymentCode}: ${result.key}`,
    );

    return result;
  }

  // verify token
  async verifyCallbackToken(token: string) {
    return await this.callbackTokenService.verifyCallbackToken(token);
  }

  /**
   * Get signed download URL for a payment receipt
   */
  async getPaymentReceiptUrl(receiptKey: string): Promise<string> {
    return await this.pdfService.generateSignedDownloadUrl(receiptKey);
  }
}
