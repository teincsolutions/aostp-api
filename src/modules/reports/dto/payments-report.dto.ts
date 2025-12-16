import { ApiProperty } from '@nestjs/swagger';
import { PaymentSource } from '@prisma/client';

export class PaymentItemDto {
  @ApiProperty({ description: 'Payment code', example: 'PAY-2025-001' })
  paymentCode: string;

  @ApiProperty({ description: 'Customer code', example: 'CUST-001' })
  customerCode: string;

  @ApiProperty({ description: 'Customer full name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({
    description: 'Payment amount in original currency',
    example: 1500.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment amount in local currency',
    example: 15000.0,
  })
  localAmount: number;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  currency: string;

  @ApiProperty({ description: 'Payment method', example: 'MOBILE_MONEY' })
  paymentMethod: string;

  @ApiProperty({
    description: 'Payment source/origin (CR-02)',
    enum: PaymentSource,
    example: PaymentSource.PAID_IN_GHANA,
  })
  paymentSource: PaymentSource;

  @ApiProperty({
    description: 'Processing timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  processedAt: Date;

  @ApiProperty({ description: 'Warehouse name', example: 'China Main' })
  warehouse: string;

  @ApiProperty({
    description: 'Processed by user',
    example: 'admin@willfind8.com',
  })
  processedBy: string;
}

export class CurrencyTotalDto {
  @ApiProperty({ description: 'Currency code', example: 'USD' })
  currency: string;

  @ApiProperty({
    description: 'Total amount in this currency',
    example: 25000.0,
  })
  total: number;
}

export class PaymentSourceTotalDto {
  @ApiProperty({
    description: 'Payment source',
    enum: PaymentSource,
    example: PaymentSource.PAID_IN_GHANA,
  })
  paymentSource: PaymentSource;

  @ApiProperty({ description: 'Number of payments', example: 50 })
  count: number;

  @ApiProperty({ description: 'Total amount', example: 15000.0 })
  totalAmount: number;

  @ApiProperty({ description: 'Total local amount', example: 150000.0 })
  totalLocalAmount: number;
}

export class PaymentTotalsDto {
  @ApiProperty({ description: 'Total in USD', example: 25000.0 })
  usdTotal: number;

  @ApiProperty({ description: 'Total in GHS', example: 250000.0 })
  ghsTotal: number;

  @ApiProperty({
    description: 'Totals for other currencies',
    type: [CurrencyTotalDto],
  })
  otherCurrencies: CurrencyTotalDto[];

  @ApiProperty({
    description: 'Breakdown by payment source (CR-02)',
    type: [PaymentSourceTotalDto],
  })
  byPaymentSource: PaymentSourceTotalDto[];
}

export class PaymentsReportResponseDto {
  @ApiProperty({ description: 'List of payments', type: [PaymentItemDto] })
  payments: PaymentItemDto[];

  @ApiProperty({
    description: 'Payment totals aggregated by currency',
    type: PaymentTotalsDto,
  })
  totals: PaymentTotalsDto;

  @ApiProperty({ description: 'Total number of payments', example: 150 })
  totalCount: number;
}
