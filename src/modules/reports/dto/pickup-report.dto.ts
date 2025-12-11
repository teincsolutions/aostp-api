import { ApiProperty } from '@nestjs/swagger';
import { PackageStatus } from '@prisma/client';

export class PickupItemDto {
  @ApiProperty({ description: 'Customer code', example: 'CUST-001' })
  customerCode: string;

  @ApiProperty({ description: 'Customer full name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Invoice number', example: 'INV-2025-001' })
  invoiceNumber: string;

  @ApiProperty({ description: 'Pickup code', example: 'PKP-2025-001' })
  pickupCode: string;

  @ApiProperty({ description: 'Pickup date', example: '2025-01-15T10:30:00Z' })
  pickupDate: Date;

  @ApiProperty({ description: 'Package quantity', example: 3 })
  quantity: number;

  @ApiProperty({ description: 'Warehouse name', example: 'Accra Branch' })
  warehouse: string;

  @ApiProperty({
    description: 'Package status',
    enum: PackageStatus,
    example: PackageStatus.RELEASED,
  })
  status: PackageStatus;

  @ApiProperty({
    description: 'Package tracking code',
    example: 'TRK-2025-001',
  })
  trackingCode: string;

  @ApiProperty({ description: 'Package description', example: 'Electronics' })
  description: string;

  @ApiProperty({ description: 'Delivery ID', example: 'DEL-2025-001' })
  deliveryId: string;

  @ApiProperty({
    description: 'Receiver name',
    example: 'Jane Doe',
    nullable: true,
  })
  receiverName: string | null;

  @ApiProperty({
    description: 'Delivery notes',
    example: 'Delivered in good condition',
  })
  notes: string;
}

export class PickupReportResponseDto {
  @ApiProperty({ description: 'List of pickup records', type: [PickupItemDto] })
  pickups: PickupItemDto[];

  @ApiProperty({ description: 'Total number of pickups', example: 75 })
  totalCount: number;
}
