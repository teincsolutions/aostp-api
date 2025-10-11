import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ContainerStatus, PackingListStatus } from '@prisma/client';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class GetPackingListsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by container ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  containerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by container status',
    enum: ContainerStatus,
    example: 'LOADING',
  })
  @IsOptional()
  @IsEnum(ContainerStatus)
  containerStatus?: ContainerStatus;

  @ApiPropertyOptional({
    description: 'Filter by packing list status',
    enum: PackingListStatus,
    example: 'DRAFT',
  })
  @IsOptional()
  @IsEnum(PackingListStatus)
  status?: PackingListStatus;

  @ApiPropertyOptional({
    description: 'Filter by loading date from (ISO string)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by loading date to (ISO string)',
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Search by packing list name or notes',
    example: 'PL-2025-01-01',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
