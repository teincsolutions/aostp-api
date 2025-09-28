import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { ContainerStatus } from '@prisma/client';

export class ContainerFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by container status',
    enum: ContainerStatus,
    example: ContainerStatus.SHIPPED,
  })
  @IsOptional()
  @IsEnum(ContainerStatus)
  status?: ContainerStatus;

  @ApiPropertyOptional({
    description: 'Filter by departure city',
    example: 'Accra',
  })
  @IsOptional()
  @IsString()
  departureCity?: string;

  @ApiPropertyOptional({
    description: 'Filter by destination city',
    example: 'London',
  })
  @IsOptional()
  @IsString()
  destinationCity?: string;

  @ApiPropertyOptional({
    description: 'Search by container number or description',
    example: 'CONT-2024-001',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
