import { ApiProperty } from '@nestjs/swagger';
import { ShippingMode } from '@prisma/client';

export class TopCustomerByShippingDto {
  @ApiProperty({ description: 'Customer code', example: 'CUST-001' })
  customerCode: string;

  @ApiProperty({ description: 'Customer full name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Total revenue from customer', example: 12000.0 })
  revenue: number;

  @ApiProperty({ description: 'Number of invoices', example: 15 })
  invoiceCount: number;
}

export class ShippingMethodStatsDto {
  @ApiProperty({
    description: 'Shipping mode',
    enum: ShippingMode,
    example: ShippingMode.SEA,
  })
  mode: ShippingMode;

  @ApiProperty({ description: 'Total revenue', example: 50000.0 })
  revenue: number;

  @ApiProperty({ description: 'Total invoice count', example: 75 })
  invoiceCount: number;

  @ApiProperty({ description: 'Outstanding invoices count', example: 20 })
  outstandingCount: number;

  @ApiProperty({ description: 'Number of unique customers', example: 45 })
  customerCount: number;

  @ApiProperty({
    description: 'Top customers using this shipping method',
    type: [TopCustomerByShippingDto],
  })
  topCustomers: TopCustomerByShippingDto[];
}

export class ShippingMethodReportResponseDto {
  @ApiProperty({
    description: 'Statistics by shipping method',
    type: [ShippingMethodStatsDto],
  })
  shippingMethods: ShippingMethodStatsDto[];
}
