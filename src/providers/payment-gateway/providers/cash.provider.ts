import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentGatewayProvider,
  ProcessPaymentData,
  PaymentResult,
  RefundPaymentData,
  RefundResult,
  PaymentStatus,
  RefundStatus,
} from '../payment-gateway.interface';

@Injectable()
export class CashProvider implements PaymentGatewayProvider {
  private readonly logger = new Logger(CashProvider.name);

  async processPayment(data: ProcessPaymentData): Promise<PaymentResult> {
    this.logger.log(
      `Processing cash payment: ${data.amount} ${data.currency} - ${data.reference}`,
    );

    // For cash payments, we consider them processed immediately
    // In a real implementation, this would create a cash receipt record
    return {
      success: true,
      gatewayTransactionId: `CASH-${data.reference}`,
      status: PaymentStatus.COMPLETED,
      fees: 0,
      gatewayResponse: {
        method: 'cash',
        currency: data.currency,
        amount: data.amount,
        processedAt: new Date().toISOString(),
      },
    };
  }

  async refundPayment(data: RefundPaymentData): Promise<RefundResult> {
    this.logger.log(`Processing cash refund: ${data.gatewayTransactionId}`);

    // For cash payments, refunds are processed immediately
    return {
      success: true,
      refundId: `REFUND-${Date.now()}`,
      status: RefundStatus.COMPLETED,
      gatewayResponse: {
        method: 'cash_refund',
        originalTransaction: data.gatewayTransactionId,
        refundedAt: new Date().toISOString(),
      },
    };
  }

  async getPaymentStatus(
    _gatewayTransactionId: string,
  ): Promise<PaymentStatus> {
    // Cash payments are immediately completed
    return PaymentStatus.COMPLETED;
  }
}
