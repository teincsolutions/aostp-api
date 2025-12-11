import { ApiProperty } from '@nestjs/swagger';

export class InvoiceStatsDto {
  @ApiProperty({ description: 'Total invoices', example: 100 })
  total: number;

  @ApiProperty({ description: 'Number of paid invoices', example: 60 })
  paid: number;

  @ApiProperty({ description: 'Number of unpaid invoices', example: 30 })
  unpaid: number;

  @ApiProperty({
    description: 'Number of partially paid invoices',
    example: 10,
  })
  partial: number;

  @ApiProperty({ description: 'Percentage of paid invoices', example: 60.0 })
  paidPercentage: number;

  @ApiProperty({ description: 'Percentage of unpaid invoices', example: 30.0 })
  unpaidPercentage: number;

  @ApiProperty({
    description: 'Percentage of partially paid invoices',
    example: 10.0,
  })
  partialPercentage: number;
}

export class PackingListItemDto {
  @ApiProperty({
    description: 'Packing list ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({ description: 'Packing list name', example: 'PL-2025-001' })
  name: string;

  @ApiProperty({ description: 'Container number', example: 'CONT-2025-001' })
  containerNumber: string;

  @ApiProperty({ description: 'Total packages', example: 50 })
  totalPackages: number;

  @ApiProperty({ description: 'Total customers', example: 25 })
  totalCustomers: number;

  @ApiProperty({ description: 'Total weight in KG', example: 1500.5 })
  totalWeight: number;

  @ApiProperty({ description: 'Total CBM', example: 45.25 })
  totalCBM: number;

  @ApiProperty({ description: 'Total shipping cost', example: 5000.0 })
  totalShippingCost: number;

  @ApiProperty({ description: 'Invoice statistics', type: InvoiceStatsDto })
  invoiceStats: InvoiceStatsDto;

  @ApiProperty({ description: 'Loading date', example: '2025-01-01T00:00:00Z' })
  loadingDate: Date;

  @ApiProperty({
    description: 'ETA',
    example: '2025-02-15T00:00:00Z',
    nullable: true,
  })
  eta: Date | null;
}

export class PackingListReportResponseDto {
  @ApiProperty({
    description: 'Total invoices across all packing lists',
    example: 100,
  })
  totalInvoices: number;

  @ApiProperty({ description: 'Total paid invoices', example: 60 })
  paid: number;

  @ApiProperty({ description: 'Total unpaid invoices', example: 30 })
  unpaid: number;

  @ApiProperty({ description: 'Total partially paid invoices', example: 10 })
  partial: number;

  @ApiProperty({ description: 'Overall paid percentage', example: 60.0 })
  paidPercentage: number;

  @ApiProperty({ description: 'Overall unpaid percentage', example: 30.0 })
  unpaidPercentage: number;

  @ApiProperty({ description: 'Overall partial percentage', example: 10.0 })
  partialPercentage: number;

  @ApiProperty({ description: 'Total shipping cost', example: 25000.0 })
  totalShippingCost: number;

  @ApiProperty({ description: 'Total CBM', example: 250.5 })
  totalCBM: number;

  @ApiProperty({ description: 'Total weight in KG', example: 7500.0 })
  totalWeight: number;

  @ApiProperty({
    description: 'Individual packing list details',
    type: [PackingListItemDto],
  })
  packingLists: PackingListItemDto[];
}
