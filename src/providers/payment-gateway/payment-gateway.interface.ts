export interface PaymentGatewayProvider {
  /**
   * Process a payment with the external gateway
   */
  processPayment(data: ProcessPaymentData): Promise<PaymentResult>;

  /**
   * Refund a payment
   */
  refundPayment(data: RefundPaymentData): Promise<RefundResult>;

  /**
   * Get payment status from gateway
   */
  getPaymentStatus(gatewayTransactionId: string): Promise<PaymentStatus>;

  /**
   * Validate webhook signature for security
   */
  verifyWebhookSignature?(signature: string, body: string): boolean;
}

export interface ProcessPaymentData {
  amount: number;
  currency: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  reference: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  gatewayTransactionId?: string;
  status: PaymentStatus;
  fees?: number;
  paymentUrl?: string;
  errorMessage?: string;
  gatewayResponse?: any;
}

export interface RefundPaymentData {
  gatewayTransactionId: string;
  amount?: number;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  status: RefundStatus;
  errorMessage?: string;
  gatewayResponse?: any;
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum RefundStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
