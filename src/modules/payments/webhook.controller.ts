import {
  Controller,
  Post,
  Body,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

interface HubtelWebhookPayload {
  ResponseCode: string;
  Status: string;
  Data: {
    CheckoutId: string;
    SalesInvoiceId: string;
    ClientReference: string;
    Status: string;
    Amount: number;
    CustomerPhoneNumber: string;
    ReceiptNumber: string;
    Description: string;
    PaymentMethod: string;
    PaymentChannel: string;
  };
}

@ApiTags('Payments')
@Controller('payments/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('hubtel')
  @ApiOperation({
    summary: 'Handle Hubtel payment webhook notifications',
    description: 'Receives payment status updates from Hubtel gateway',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook payload',
  })
  async handleHubtelWebhook(
    @Body() payload: HubtelWebhookPayload,
  ): Promise<{ message: string }> {
    this.logger.log(`Received Hubtel webhook: ${JSON.stringify(payload)}`);

    try {
      // Validate required payload fields
      if (!payload.Data || !payload.Data.CheckoutId || !payload.Data.Status) {
        throw new BadRequestException('Invalid webhook payload structure');
      }

      const { Data } = payload;

      // Process webhook based on status
      if (payload.Status === 'Successful') {
        await this.processSuccessfulPayment(Data);
      } else if (payload.Status === 'Failed') {
        await this.processFailedPayment(Data);
      } else {
        this.logger.warn(`Unknown payment status: ${payload.Status}`);
      }

      return { message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(
        `Failed to process Hubtel webhook: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async processSuccessfulPayment(
    data: HubtelWebhookPayload['Data'],
  ): Promise<void> {
    try {
      // Log successful payment - simplified implementation
      // In production, this would find and update the payment record
      this.logger.log(
        `Hubtel payment successful: ${data.CheckoutId} - Amount: ${data.Amount}`,
      );

      // TODO: Implement actual payment lookup and status update
      // The payments service would need methods to:
      // 1. Find payment by gateway reference ID (CheckoutId)
      // 2. Update payment status and metadata
      // 3. Update associated invoices
    } catch (error) {
      this.logger.error(
        `Failed to process successful payment: ${error.message}`,
      );
    }
  }

  private async processFailedPayment(
    data: HubtelWebhookPayload['Data'],
  ): Promise<void> {
    try {
      // Log failed payment - simplified implementation
      this.logger.log(
        `Hubtel payment failed: ${data.CheckoutId} - ${data.Description}`,
      );

      // TODO: Implement actual payment failure handling
      // Similar to success processing but mark payment as failed
    } catch (error) {
      this.logger.error(`Failed to process failed payment: ${error.message}`);
    }
  }

  private async updateInvoicePayments(paymentId: string): Promise<void> {
    this.logger.log(`Updating invoice payments for payment ${paymentId}`);
  }
}
