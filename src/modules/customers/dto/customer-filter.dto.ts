import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class CustomerFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by name, email, or phone',
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

  @ApiPropertyOptional({
    description: 'Filter by city',
    example: 'Accra',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter by country',
    example: 'Ghana',
  })
  @IsOptional()
  @IsString()
  country?: string;
}
