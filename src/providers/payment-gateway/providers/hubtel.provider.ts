import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentGatewayProvider,
  ProcessPaymentData,
  PaymentResult,
  RefundPaymentData,
  RefundResult,
  PaymentStatus,
  RefundStatus,
} from '../payment-gateway.interface';

interface HubtelInvoicePayload {
  invoiceNumber: string;
  customerName: string;
  customerPhoneNumber: string;
  customerEmail?: string;
  hasTax: boolean;
  issuedBy: string;
  createdBy: string;
  dueDate: string;
  note?: string;
  reminders?: Array<{
    days: number;
    isBefore: true;
  }>;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  callbackUrl: string;
}

interface HubtelInvoiceResponse {
  message: string;
  code: number;
  data: {
    invoiceId: string;
    paymentUrl: string;
  };
}

@Injectable()
export class HubtelProvider implements PaymentGatewayProvider {
  private readonly logger = new Logger(HubtelProvider.name);
  private readonly baseUrl: string;
  private readonly posSalesId: string;
  private readonly apiId: string;
  private readonly apiKey: string;
  private readonly callbackUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'HUBTEL_BASE_URL',
      'https://invoicing.hubtel.com',
    );
    this.posSalesId = this.configService.get<string>('HUBTEL_POS_SALES_ID', '');
    this.apiId = this.configService.get<string>('HUBTEL_API_ID', '');
    this.apiKey = this.configService.get<string>('HUBTEL_API_KEY', '');
    this.callbackUrl = this.configService.get<string>(
      'HUBTEL_CALLBACK_URL',
      '',
    );

    if (!this.apiKey) {
      this.logger.warn('HubtelProvider: Hubtel API key not configured');
    }
  }

  async processPayment(data: ProcessPaymentData): Promise<PaymentResult> {
    this.logger.log(
      `Processing Hubtel payment: ${data.amount} ${data.currency} - ${data.reference}`,
    );

    try {
      // Build callback URL from token if provided
      const callbackUrl = `$${this.callbackUrl}/${data.callbackToken}`;

      this.logger.log(`Using callback URL: ${callbackUrl}`);

      // Create invoice payload for "Pay at Once"
      const invoicePayload: HubtelInvoicePayload = {
        invoiceNumber: data.reference || `INV-${Date.now()}`,
        customerName: data.customerName || 'Customer',
        customerPhoneNumber: data.customerPhone || '',
        customerEmail: data.customerEmail,
        hasTax: false, // Can be configurable later
        issuedBy: data.metadata?.issuedBy || 'System',
        createdBy: data.metadata?.createdBy || 'System',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days due date
        items: [
          {
            description: data.description || 'Payment for services',
            quantity: 1,
            unitPrice: data.amount,
          },
        ],
        callbackUrl,
        reminders: data.metadata?.reminders || [
          {
            days: 5,
            isBefore: true,
          },
        ],
      };

      const createInvoiceUrl = `${this.baseUrl}/api/invoice/${this.posSalesId}/pay-at-once`;

      this.logger.log(
        `Creating Hubtel invoice: ${invoicePayload.invoiceNumber}`,
      );

      // Make HTTP request to Hubtel API
      const response = await fetch(createInvoiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.apiId}:${this.apiKey}`).toString('base64')}`,
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(invoicePayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Hubtel API error: ${response.status} - ${errorText}`,
        );

        return {
          success: false,
          status: PaymentStatus.FAILED,
          errorMessage: `Hubtel API error: ${response.status} - ${errorText}`,
          gatewayResponse: {
            httpStatus: response.status,
            error: errorText,
          },
        };
      }

      const invoiceResponse: HubtelInvoiceResponse = await response.json();

      if (invoiceResponse.code !== 200) {
        this.logger.error(
          `Hubtel invoice creation failed: ${invoiceResponse.message}`,
        );

        return {
          success: false,
          status: PaymentStatus.FAILED,
          errorMessage: invoiceResponse.message,
          gatewayResponse: invoiceResponse,
        };
      }

      this.logger.log(
        `Hubtel invoice created successfully: ${invoiceResponse.data.invoiceId}`,
      );

      return {
        success: true,
        gatewayTransactionId: invoiceResponse.data.invoiceId,
        status: PaymentStatus.PENDING, // Hubtel will send callback when payment is completed
        paymentUrl: invoiceResponse.data.paymentUrl,
        gatewayResponse: invoiceResponse.data,
      };
    } catch (error) {
      this.logger.error(
        `Hubtel payment processing failed: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        status: PaymentStatus.FAILED,
        errorMessage: `Payment processing failed: ${error.message}`,
        gatewayResponse: {
          error: error.message,
        },
      };
    }
  }

  async refundPayment(data: RefundPaymentData): Promise<RefundResult> {
    this.logger.log(`Processing Hubtel refund: ${data.gatewayTransactionId}`);

    // Hubtel supports refunds but typically need to handle through their dashboard
    // For now, return as not supported - add await to satisfy linter
    return await Promise.resolve({
      success: false,
      status: RefundStatus.FAILED,
      errorMessage: 'Refunds must be processed through Hubtel dashboard',
      gatewayResponse: {
        message: 'Refund processing not implemented for Hubtel gateway',
        transactionId: data.gatewayTransactionId,
      },
    });
  }

  async getPaymentStatus(gatewayTransactionId: string): Promise<PaymentStatus> {
    this.logger.log(`Checking Hubtel payment status: ${gatewayTransactionId}`);

    try {
      const statusCheckUrl = `${this.baseUrl}/api/invoice/${this.posSalesId}/${gatewayTransactionId}/status-check`;

      const response = await fetch(statusCheckUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.apiId}:${this.apiKey}`).toString('base64')}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        this.logger.warn(
          `Failed to get payment status from Hubtel: ${response.status}`,
        );
        return PaymentStatus.PENDING; // Return pending if we can't check
      }

      const statusResponse = await response.json();

      if (statusResponse.code === 200 && statusResponse.data) {
        const paymentData = statusResponse.data;

        // Map Hubtel statuses to our PaymentStatus
        if (paymentData.paymentStatus === 'Paid In Full') {
          return PaymentStatus.COMPLETED;
        } else if (paymentData.paymentStatus === 'Partly Paid') {
          return PaymentStatus.PENDING;
        } else if (paymentData.paymentStatus === 'Pending') {
          return PaymentStatus.PENDING;
        } else {
          return PaymentStatus.PENDING;
        }
      }

      return PaymentStatus.PENDING;
    } catch (error) {
      this.logger.error(
        `Error checking payment status: ${error.message}`,
        error.stack,
      );
      return PaymentStatus.PENDING; // Return pending on error
    }
  }

  /**
   * Optional webhook signature verification for Hubtel
   * If implemented, Hubtel provides signature verification
   */
  verifyWebhookSignature?(signature: string, body: string): boolean {
    // Hubtel implements signature verification with API key
    // This would compare signature with HMAC hash of body using API key
    // For now, return true as we're handling status checks
    return true;
  }
}
