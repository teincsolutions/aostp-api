import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PackageStatus } from '@prisma/client';
import {
  IsOptional,
  IsDateString,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../shared/constants';

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

export class PickupReportQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by start date (ISO 8601 format)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by end date (ISO 8601 format)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by warehouse ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by invoice ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiPropertyOptional({
    description: 'Filter by packing list ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  packingListId?: string;

  @ApiPropertyOptional({
    description: 'Filter by tracking code (partial match)',
    example: 'TR-2025-001',
  })
  @IsOptional()
  @IsString()
  trackingCode?: string;

  @ApiPropertyOptional({
    description: 'Filter by delivery ID (partial match)',
    example: 'DEL001-2025001',
  })
  @IsOptional()
  @IsString()
  deliveryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by receiver name (partial match)',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  receiverName?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'releaseDate',
  })
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class PaginationMetaDto {
  @ApiProperty({ description: 'Total number of records', example: 150 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 8 })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page', example: true })
  hasNextPage: boolean;

  @ApiProperty({ description: 'Whether there is a previous page', example: false })
  hasPreviousPage: boolean;
}

export class PickupReportResponseDto {
  @ApiProperty({ description: 'List of pickup records', type: [PickupItemDto] })
  pickups: PickupItemDto[];

  @ApiProperty({ description: 'Total number of pickups', example: 75 })
  totalCount: number;

  @ApiProperty({ description: 'Pagination metadata', type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
