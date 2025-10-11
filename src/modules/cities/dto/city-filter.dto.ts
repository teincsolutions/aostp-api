import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class CityFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by country',
    example: 'Ghana',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Search by city name',
    example: 'Accra',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
