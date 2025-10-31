import { IsOptional, IsDateString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardFiltersDto {
  @ApiPropertyOptional({
    description: 'Filter data from this date (ISO date string)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter data to this date (ISO date string)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'IN_WAREHOUSE',
  })
  @IsOptional()
  @IsString()
  status?: string;
}
