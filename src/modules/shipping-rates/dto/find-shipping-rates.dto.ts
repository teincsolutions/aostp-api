import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShippingMode, AirShippingType } from '@prisma/client';
import { Type } from 'class-transformer';

export class FindShippingRatesDto {
  @ApiPropertyOptional({
    description: 'Filter by shipping mode',
    enum: ShippingMode,
    example: ShippingMode.SEA,
  })
  @IsOptional()
  @IsEnum(ShippingMode)
  shippingMode?: ShippingMode;

  @ApiPropertyOptional({
    description: 'Filter by air shipping type',
    enum: AirShippingType,
    example: AirShippingType.NORMAL_AIR,
  })
  @IsOptional()
  @IsEnum(AirShippingType)
  airShippingType?: AirShippingType;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    type: Boolean,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by currency',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
