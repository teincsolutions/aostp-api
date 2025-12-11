import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class FilterPackageDeliveryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: 'uuid-customer-id',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by invoice ID',
    example: 'uuid-invoice-id',
  })
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional({
    description: 'Filter by package ID',
    example: 'uuid-package-id',
  })
  @IsOptional()
  @IsString()
  packageId?: string;

  @ApiPropertyOptional({
    description: 'Filter by tracking code',
    example: 'TR-2025-001',
  })
  @IsOptional()
  @IsString()
  trackingCode?: string;

  @ApiPropertyOptional({
    description: 'Filter by warehouse ID',
    example: 'uuid-warehouse-id',
  })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by packing list ID',
    example: 'uuid-packing-list-id',
  })
  @IsOptional()
  @IsString()
  packingListId?: string;

  @ApiPropertyOptional({
    description: 'Filter by delivery ID',
    example: 'DEL001-2025001',
  })
  @IsOptional()
  @IsString()
  deliveryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by receiver name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  receiverName?: string;

  @ApiPropertyOptional({
    description: 'Filter from date (ISO format: YYYY-MM-DD)',
    example: '2025-12-01',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (ISO format: YYYY-MM-DD)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;
}
