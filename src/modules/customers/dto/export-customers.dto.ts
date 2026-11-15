import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export const CUSTOMER_EXPORT_FORMATS = ['pdf', 'excel'] as const;

export type CustomerExportFormat = (typeof CUSTOMER_EXPORT_FORMATS)[number];

export class ExportCustomersDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Customer IDs to export. Accepts a comma-separated list or repeated query params. When provided, other filters are ignored.',
    type: [String],
    example: '3f1b2c4d-0000-4000-8000-000000000001',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const values = Array.isArray(value) ? value : [value];

    const ids = values
      .flatMap((entry) => String(entry).split(','))
      .map((entry) => entry.trim())
      .filter(Boolean);

    return ids.length > 0 ? ids : undefined;
  })
  @IsArray()
  @IsString({ each: true })
  ids?: string[];

  @ApiProperty({
    description: 'Export file format',
    enum: CUSTOMER_EXPORT_FORMATS,
    example: 'pdf',
  })
  @IsIn(CUSTOMER_EXPORT_FORMATS)
  format: CustomerExportFormat;

  @ApiPropertyOptional({
    description: 'Search by name, email, phone, or customer code',
    example: 'john@example.com',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    enum: ['true', 'false'],
    example: 'true',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;
}
