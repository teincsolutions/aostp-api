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
export class MobileMoneyProvider implements PaymentGatewayProvider {
  private readonly logger = new Logger(MobileMoneyProvider.name);

  async processPayment(data: ProcessPaymentData): Promise<PaymentResult> {
    this.logger.log(
      `Processing mobile money payment: ${data.amount} ${data.currency} - ${data.reference}`,
    );

    // For mobile money, initiate payment request
    // In a real implementation, this would integrate with providers like MTN, Airtel, etc.
    return {
      success: true,
      gatewayTransactionId: `MM-${Date.now()}`,
      status: PaymentStatus.PENDING,
      fees: data.amount * 0.015, // 1.5% fee for mobile money
      gatewayResponse: {
        method: 'mobile_money',
        currency: data.currency,
        amount: data.amount,
        recipientPhone: data.customerPhone,
        transactionRef: `AOSTP-${data.reference}`,
        verificationCode: '123456', // Generated verification code
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      },
    };
  }

  async refundPayment(data: RefundPaymentData): Promise<RefundResult> {
    this.logger.log(
      `Processing mobile money refund: ${data.gatewayTransactionId}`,
    );

    // Mobile money refunds can be processed automatically
    return {
      success: true,
      refundId: `REFUND-MM-${Date.now()}`,
      status: RefundStatus.COMPLETED,
      gatewayResponse: {
        method: 'mobile_money_refund',
        originalTransaction: data.gatewayTransactionId,
        refundProcessed: true,
        processedAt: new Date().toISOString(),
      },
    };
  }

  async getPaymentStatus(
    _gatewayTransactionId: string,
  ): Promise<PaymentStatus> {
    // In a real implementation, this would query the mobile money provider
    // For now, return pending as mobile money transactions are typically processed quickly
    return PaymentStatus.PENDING;
  }
}
