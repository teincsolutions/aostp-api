import { Type } from 'class-transformer';
import {
  IsOptional,
  IsInt,
  Min,
  IsString,
  IsIn,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PackageStatus } from '@prisma/client';

export class WarehousePackagesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Warehouse ID to filter by',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Package status to filter by',
    enum: PackageStatus,
    example: PackageStatus.IN_WAREHOUSE,
  })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Minimum days in warehouse',
    example: 7,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  daysThreshold?: number;

  @ApiPropertyOptional({
    description: 'Filter packages from this date (YYYY-MM-DD)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter packages to this date (YYYY-MM-DD)',
    example: '2025-01-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Search by tracking code, description, or customer name',
    example: 'PKG-2024-001',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
