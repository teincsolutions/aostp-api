import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentGatewayProvider,
  ProcessPaymentData,
  PaymentResult,
} from './payment-gateway.interface';
import { CashProvider } from './providers/cash.provider';
import { BankTransferProvider } from './providers/bank-transfer.provider';
import { HubtelProvider } from './providers/hubtel.provider';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private readonly providers: Map<string, PaymentGatewayProvider> = new Map();

  constructor(
    private readonly cashProvider: CashProvider,
    private readonly bankTransferProvider: BankTransferProvider,
    private readonly hubtelProvider: HubtelProvider,
  ) {
    // Register providers
    this.providers.set('CASH', cashProvider);
    this.providers.set('BANK_TRANSFER', bankTransferProvider);
    this.providers.set('HUBTEL', hubtelProvider);
    this.providers.set('MOBILE_MONEY', hubtelProvider); // Mobile money uses Hubtel provider
  }

  /**
   * Process a payment using the appropriate gateway provider
   */
  async processPayment(
    paymentMethod: string,
    data: ProcessPaymentData,
  ): Promise<PaymentResult> {
    const provider = this.providers.get(paymentMethod);

    if (!provider) {
      throw new Error(`Payment method ${paymentMethod} is not supported`);
    }

    this.logger.log(`Processing payment via ${paymentMethod} provider`);

    // If no callback URL provided, this is not a gateway payment - just process normally
    // Gateway payments will have callbackUrl set by the payments service
    return provider.processPayment(data);
  }

  /**
   * Process a refund using the appropriate gateway provider
   */
  async processRefund(
    paymentMethod: string,
    gatewayTransactionId: string,
    amount?: number,
    reason?: string,
  ) {
    const provider = this.providers.get(paymentMethod);

    if (!provider) {
      throw new Error(`Payment method ${paymentMethod} is not supported`);
    }

    this.logger.log(`Processing refund via ${paymentMethod} provider`);

    return provider.refundPayment({
      gatewayTransactionId,
      amount,
      reason,
    });
  }

  /**
   * Get payment status from the gateway provider
   */
  async getPaymentStatus(paymentMethod: string, gatewayTransactionId: string) {
    const provider = this.providers.get(paymentMethod);

    if (!provider) {
      throw new Error(`Payment method ${paymentMethod} is not supported`);
    }

    return provider.getPaymentStatus(gatewayTransactionId);
  }

  /**
   * Get all supported payment methods
   */
  getSupportedMethods(): string[] {
    return Array.from(this.providers.keys());
  }
}
