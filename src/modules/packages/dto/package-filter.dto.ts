import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PackageStatus, PaymentStatus } from '@prisma/client';

export class PackageFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by package status',
    enum: PackageStatus,
    example: PackageStatus.RECEIVED,
  })
  @IsOptional()
  @IsEnum(PackageStatus)
  status?: PackageStatus;

  @ApiPropertyOptional({
    description: 'Filter by shipping mode',
    enum: ['SEA', 'AIR'] as const,
    example: 'SEA',
  })
  @IsOptional()
  @IsEnum(['SEA', 'AIR'] as const)
  shippingMode?: 'SEA' | 'AIR';

  @ApiPropertyOptional({
    description: 'Filter by packing list ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  packingListId?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Search by tracking code, description, or customer name',
    example: 'PKG-2024-001',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
