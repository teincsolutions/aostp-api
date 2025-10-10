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
export class BankTransferProvider implements PaymentGatewayProvider {
  private readonly logger = new Logger(BankTransferProvider.name);

  async processPayment(data: ProcessPaymentData): Promise<PaymentResult> {
    this.logger.log(
      `Processing bank transfer: ${data.amount} ${data.currency} - ${data.reference}`,
    );

    // For bank transfers, we create a pending transaction
    // In a real implementation, this would integrate with bank APIs or create bank reference
    return {
      success: true,
      gatewayTransactionId: `BT-${Date.now()}`,
      status: PaymentStatus.PENDING,
      fees: 0.5, // Example fee for bank transfer
      gatewayResponse: {
        method: 'bank_transfer',
        currency: data.currency,
        amount: data.amount,
        bankReference: `AOSTP-${data.reference}`,
        processingDays: 3,
        initiatedAt: new Date().toISOString(),
      },
    };
  }

  async refundPayment(data: RefundPaymentData): Promise<RefundResult> {
    this.logger.log(
      `Processing bank transfer refund: ${data.gatewayTransactionId}`,
    );

    // Bank transfer refunds require manual processing
    return {
      success: true,
      refundId: `REFUND-BT-${Date.now()}`,
      status: RefundStatus.PENDING,
      gatewayResponse: {
        method: 'bank_transfer_refund',
        originalTransaction: data.gatewayTransactionId,
        status: 'Manual processing required',
        processingNotes:
          'Bank transfer refunds require manual bank instruction',
      },
    };
  }

  async getPaymentStatus(
    _gatewayTransactionId: string,
  ): Promise<PaymentStatus> {
    // In a real implementation, this would query the bank API
    // For now, return pending as transfers take time
    return PaymentStatus.PENDING;
  }
}
