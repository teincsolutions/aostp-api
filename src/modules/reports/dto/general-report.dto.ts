import { ApiProperty } from '@nestjs/swagger';
import { ShippingMode } from '@prisma/client';

export class GeneralCustomerDto {
  @ApiProperty({ description: 'Customer code', example: 'CUST-001' })
  customerCode: string;

  @ApiProperty({ description: 'Customer full name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Total invoice count', example: 25 })
  totalInvoices: number;

  @ApiProperty({ description: 'Total invoice amount', example: 50000.0 })
  totalInvoiceAmount: number;

  @ApiProperty({ description: 'Total payment count', example: 30 })
  totalPayments: number;

  @ApiProperty({ description: 'Total payment amount', example: 48000.0 })
  totalPaymentAmount: number;

  @ApiProperty({
    description: 'Pickup rate (delivered packages / total packages)',
    example: 0.92,
  })
  pickupRate: number;

  @ApiProperty({
    description: 'Shipping modes used',
    enum: ShippingMode,
    isArray: true,
    example: [ShippingMode.SEA, ShippingMode.AIR],
  })
  shippingModesUsed: ShippingMode[];

  @ApiProperty({
    description: 'First transaction date',
    example: '2024-01-15T00:00:00Z',
  })
  firstDate: Date;

  @ApiProperty({
    description: 'Last transaction date',
    example: '2025-11-20T00:00:00Z',
  })
  lastDate: Date;
}

export class GeneralReportResponseDto {
  @ApiProperty({
    description: 'Top customers with comprehensive metrics',
    type: [GeneralCustomerDto],
  })
  topCustomers: GeneralCustomerDto[];

  @ApiProperty({
    description: 'Total number of customers analyzed',
    example: 50,
  })
  totalCustomers: number;
}
