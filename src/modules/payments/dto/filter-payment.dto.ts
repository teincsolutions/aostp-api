import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class FilterPaymentDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: 'uuid-customer-id',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment method',
    enum: [
      'CASH',
      'BANK_TRANSFER',
      'DIRECT_MOMO_TRANSFER',
      'MOBILE_MONEY',
      'CARD',
      'CREDIT_CARD',
    ],
    example: 'CASH',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Filter by currency code',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Filter from date (ISO format)',
    example: '2025-12-01',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (ISO format)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by packing list ID',
    example: 'uuid-packing-list-id',
  })
  @IsOptional()
  @IsString()
  packingListId?: string;

  @ApiPropertyOptional({
    description: 'Filter by warehouse ID',
    example: 'uuid-warehouse-id',
  })
  @IsOptional()
  @IsString()
  warehouseId?: string;
}
