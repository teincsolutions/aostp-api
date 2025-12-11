import { ApiProperty } from '@nestjs/swagger';
import {
  InvoiceStatus,
  PackageStatus,
  PackingListStatus,
} from '@prisma/client';

// Recent Intakes
export class RecentIntakeDto {
  @ApiProperty({ description: 'Package item ID', example: '123e4567...' })
  id: string;

  @ApiProperty({
    description: 'Intake tracking code',
    example: 'ITK-2025-001',
  })
  intakeTrackingCode: string;

  @ApiProperty({ description: 'Customer code', example: 'C001' })
  customerCode: string;

  @ApiProperty({ description: 'Customer name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Description', example: 'Electronics' })
  description: string;

  @ApiProperty({ description: 'Quantity', example: 2 })
  quantity: number;

  @ApiProperty({ description: 'Weight in KG', example: 5.5, nullable: true })
  weight: number | null;

  @ApiProperty({ description: 'CBM', example: 0.5, nullable: true })
  cbm: number | null;

  @ApiProperty({ description: 'Intake date', example: '2025-01-15T10:30:00Z' })
  intakeDate: Date;

  @ApiProperty({ description: 'Warehouse name', example: 'China Main' })
  warehouse: string;
}

export class RecentIntakesResponseDto {
  @ApiProperty({
    description: 'List of recent intakes',
    type: [RecentIntakeDto],
  })
  items: RecentIntakeDto[];

  @ApiProperty({ description: 'Total count', example: 20 })
  total: number;

  @ApiProperty({
    description: 'Cursor for next page',
    example: '123e4567...',
    nullable: true,
  })
  nextCursor: string | null;
}

// Recent Invoices vs Payments
export class RecentInvoicePaymentDto {
  @ApiProperty({ description: 'Invoice ID', example: '123e4567...' })
  id: string;

  @ApiProperty({ description: 'Invoice number', example: 'INV-2025-001' })
  invoiceNumber: string;

  @ApiProperty({ description: 'Customer code', example: 'C001' })
  customerCode: string;

  @ApiProperty({ description: 'Customer name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Total invoice amount', example: 5000 })
  totalAmount: number;

  @ApiProperty({ description: 'Amount paid', example: 3000 })
  paidAmount: number;

  @ApiProperty({ description: 'Outstanding balance', example: 2000 })
  balance: number;

  @ApiProperty({
    description: 'Invoice status',
    enum: InvoiceStatus,
    example: InvoiceStatus.PARTIALLY_PAID,
  })
  status: InvoiceStatus;

  @ApiProperty({ description: 'Number of payments', example: 2 })
  paymentCount: number;

  @ApiProperty({ description: 'Created date', example: '2025-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Due date', example: '2025-02-15T23:59:59Z' })
  dueDate: Date;
}

export class RecentInvoicesPaymentsResponseDto {
  @ApiProperty({
    description: 'List of recent invoices with payment status',
    type: [RecentInvoicePaymentDto],
  })
  items: RecentInvoicePaymentDto[];

  @ApiProperty({ description: 'Total count', example: 20 })
  total: number;

  @ApiProperty({
    description: 'Cursor for next page',
    example: '123e4567...',
    nullable: true,
  })
  nextCursor: string | null;
}

// Recent Aged Packages
export class RecentAgedPackageDto {
  @ApiProperty({ description: 'Package ID', example: '123e4567...' })
  id: string;

  @ApiProperty({ description: 'Tracking code', example: 'TRK-2025-001' })
  trackingCode: string;

  @ApiProperty({ description: 'Customer code', example: 'C001' })
  customerCode: string;

  @ApiProperty({ description: 'Customer name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Description', example: 'Electronics' })
  description: string;

  @ApiProperty({
    description: 'Package status',
    enum: PackageStatus,
    example: PackageStatus.ARRIVED,
  })
  status: PackageStatus;

  @ApiProperty({
    description: 'Days in warehouse',
    example: 45,
  })
  daysInWarehouse: number;

  @ApiProperty({
    description: 'Received date',
    example: '2024-11-01T10:00:00Z',
  })
  receivedDate: Date;

  @ApiProperty({ description: 'Warehouse name', example: 'Accra Branch' })
  warehouse: string;
}

export class RecentAgedPackagesResponseDto {
  @ApiProperty({
    description: 'List of aged packages',
    type: [RecentAgedPackageDto],
  })
  items: RecentAgedPackageDto[];

  @ApiProperty({ description: 'Total count', example: 20 })
  total: number;

  @ApiProperty({
    description: 'Cursor for next page',
    example: '123e4567...',
    nullable: true,
  })
  nextCursor: string | null;
}

// Recent Packing Lists
export class RecentPackingListDto {
  @ApiProperty({ description: 'Packing list ID', example: '123e4567...' })
  id: string;

  @ApiProperty({ description: 'Packing list name', example: 'PL-2025-001' })
  name: string;

  @ApiProperty({ description: 'Container number', example: 'CONT-2025-001' })
  containerNumber: string;

  @ApiProperty({
    description: 'Status',
    enum: PackingListStatus,
    example: PackingListStatus.FINALIZED,
  })
  status: PackingListStatus;

  @ApiProperty({ description: 'Total packages', example: 50 })
  totalPackages: number;

  @ApiProperty({ description: 'Total customers', example: 25 })
  totalCustomers: number;

  @ApiProperty({ description: 'Total CBM', example: 45.5 })
  totalCBM: number;

  @ApiProperty({ description: 'Total weight', example: 1500 })
  totalWeight: number;

  @ApiProperty({
    description: 'Loading date',
    example: '2025-01-01T00:00:00Z',
  })
  loadingDate: Date;

  @ApiProperty({
    description: 'ETA',
    example: '2025-02-15T00:00:00Z',
    nullable: true,
  })
  eta: Date | null;

  @ApiProperty({ description: 'Warehouse name', example: 'China Main' })
  warehouse: string;
}

export class RecentPackingListsResponseDto {
  @ApiProperty({
    description: 'List of recent packing lists',
    type: [RecentPackingListDto],
  })
  items: RecentPackingListDto[];

  @ApiProperty({ description: 'Total count', example: 20 })
  total: number;

  @ApiProperty({
    description: 'Cursor for next page',
    example: '123e4567...',
    nullable: true,
  })
  nextCursor: string | null;
}

// Recent Pickups
export class RecentPickupDto {
  @ApiProperty({ description: 'Delivery ID', example: 'DEL-2025-001' })
  deliveryId: string;

  @ApiProperty({ description: 'Customer code', example: 'C001' })
  customerCode: string;

  @ApiProperty({ description: 'Customer name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Invoice number', example: 'INV-2025-001' })
  invoiceNumber: string;

  @ApiProperty({ description: 'Tracking code', example: 'TRK-2025-001' })
  trackingCode: string;

  @ApiProperty({
    description: 'Pickup code',
    example: 'PKP-2025-001',
    nullable: true,
  })
  pickupCode: string | null;

  @ApiProperty({ description: 'Quantity', example: 3 })
  quantity: number;

  @ApiProperty({
    description: 'Receiver name',
    example: 'Jane Doe',
    nullable: true,
  })
  receiverName: string | null;

  @ApiProperty({ description: 'Release date', example: '2025-01-15T14:30:00Z' })
  releaseDate: Date;

  @ApiProperty({ description: 'Warehouse', example: 'Accra Branch' })
  warehouse: string;
}

export class RecentPickupsResponseDto {
  @ApiProperty({
    description: 'List of recent pickups',
    type: [RecentPickupDto],
  })
  items: RecentPickupDto[];

  @ApiProperty({ description: 'Total count', example: 20 })
  total: number;

  @ApiProperty({
    description: 'Cursor for next page',
    example: '123e4567...',
    nullable: true,
  })
  nextCursor: string | null;
}
