import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class InvoiceFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by invoice status',
    enum: InvoiceStatus,
    example: InvoiceStatus.UNPAID,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description: 'Filter by packing list ID',
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  packingListId?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices created from this date',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices created until this date',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description:
      'Search across invoice number, package tracking code, pickup code, packing list name, and container number',
    example: 'INV-2025-001234',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
