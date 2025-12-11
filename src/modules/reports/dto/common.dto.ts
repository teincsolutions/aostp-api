import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsDateString, IsUUID, IsEnum } from 'class-validator';
import { ShippingMode } from '@prisma/client';

export class ReportQueryDto {
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
    description: 'Filter by warehouse ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by shipping mode',
    enum: ShippingMode,
    example: ShippingMode.SEA,
  })
  @IsOptional()
  @IsEnum(ShippingMode)
  shippingMode?: ShippingMode;

  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
