import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';

export class DebtorInvoiceDto {
  @ApiProperty({ description: 'Invoice number', example: 'INV-2025-001' })
  invoiceNumber: string;

  @ApiProperty({ description: 'Invoice status', enum: InvoiceStatus })
  status: InvoiceStatus;

  @ApiProperty({ description: 'Total invoice amount in USD', example: 500.0 })
  totalAmount: number;

  @ApiProperty({ description: 'Amount already paid in USD', example: 200.0 })
  paidAmount: number;

  @ApiProperty({ description: 'Outstanding balance in USD', example: 300.0 })
  balance: number;

  @ApiProperty({ description: 'Invoice currency', example: 'USD' })
  currency: string;

  @ApiProperty({ description: 'Invoice due date', example: '2025-03-01T00:00:00Z' })
  dueDate: Date;

  @ApiProperty({ description: 'Invoice creation date', example: '2025-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Packing list name',
    example: 'PL-2025-001',
  })
  packingListName?: string;

  @ApiPropertyOptional({
    description: 'Packing list ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  packingListId?: string;
}

export class DebtorPackingListDto {
  @ApiProperty({
    description: 'Packing list ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({ description: 'Packing list name', example: 'PL-2025-001' })
  name: string;

  @ApiProperty({
    description: 'Number of outstanding invoices in this packing list',
    example: 3,
  })
  invoiceCount: number;

  @ApiProperty({
    description: 'Total outstanding balance for this packing list',
    example: 900.0,
  })
  outstandingBalance: number;
}

export class DebtorItemDto {
  @ApiProperty({ description: 'Customer code', example: 'CUST-001' })
  customerCode: string;

  @ApiProperty({ description: 'Customer full name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Customer phone number', example: '+233244000001' })
  phoneNumber: string;

  @ApiPropertyOptional({
    description: 'Customer email address',
    example: 'john.doe@example.com',
  })
  email?: string;

  @ApiProperty({ description: 'Warehouse name', example: 'China Main' })
  warehouse: string;

  @ApiProperty({
    description: 'Sum of totalAmount across all outstanding invoices',
    example: 1500.0,
  })
  totalInvoiceAmount: number;

  @ApiProperty({
    description: 'Sum of paidAmount across all outstanding invoices',
    example: 500.0,
  })
  totalPaidAmount: number;

  @ApiProperty({
    description: 'Total outstanding balance (totalInvoiceAmount - totalPaidAmount)',
    example: 1000.0,
  })
  outstandingBalance: number;

  @ApiProperty({
    description: 'Number of outstanding invoices (UNPAID or PARTIALLY_PAID)',
    example: 3,
  })
  invoiceCount: number;

  @ApiProperty({
    description: 'Number of distinct packing lists with outstanding invoices',
    example: 2,
  })
  packingListCount: number;

  @ApiProperty({
    description: 'Packing lists with outstanding balances',
    type: [DebtorPackingListDto],
  })
  packingLists: DebtorPackingListDto[];

  @ApiProperty({
    description: 'Outstanding invoices detail',
    type: [DebtorInvoiceDto],
  })
  invoices: DebtorInvoiceDto[];

  @ApiProperty({
    description: 'Date of the most recent outstanding invoice',
    example: '2025-01-20T00:00:00Z',
  })
  lastInvoiceDate: Date;

  @ApiProperty({ description: 'Rank by outstanding balance', example: 1 })
  rank: number;
}

export class DebtorsSummaryDto {
  @ApiProperty({
    description: 'Total number of customers with outstanding balances',
    example: 42,
  })
  totalDebtors: number;

  @ApiProperty({
    description: 'Grand total of all outstanding balances',
    example: 85000.0,
  })
  totalOutstanding: number;

  @ApiProperty({
    description: 'Grand total of invoice amounts across all debtors',
    example: 120000.0,
  })
  totalInvoiceAmount: number;

  @ApiProperty({
    description: 'Grand total of payments made towards outstanding invoices',
    example: 35000.0,
  })
  totalPaidAmount: number;

  @ApiProperty({
    description: 'Overall collection rate as a percentage',
    example: 29.17,
  })
  collectionRate: number;
}

export class DebtorsReportResponseDto {
  @ApiProperty({
    description: 'List of debtors sorted by outstanding balance (highest first)',
    type: [DebtorItemDto],
  })
  debtors: DebtorItemDto[];

  @ApiProperty({
    description: 'Aggregated summary figures',
    type: DebtorsSummaryDto,
  })
  summary: DebtorsSummaryDto;

  @ApiProperty({ description: 'Total number of debtors returned', example: 42 })
  totalCount: number;
}
