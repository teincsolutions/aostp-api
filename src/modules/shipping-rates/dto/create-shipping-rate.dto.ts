import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShippingMode, AirShippingType } from '@prisma/client';

export class CreateShippingRateDto {
  @ApiProperty({ description: 'Shipping mode', enum: ShippingMode })
  @IsEnum(ShippingMode)
  shippingMode: ShippingMode;

  @ApiPropertyOptional({
    description: 'Air shipping type (required for air shipping)',
    enum: AirShippingType,
  })
  @IsOptional()
  @IsEnum(AirShippingType)
  airShippingType?: AirShippingType;

  @ApiProperty({
    description: 'Rate per unit (CBM for sea, KG for air)',
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  ratePerUnit: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @ApiPropertyOptional({ description: 'Effective from date' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Effective to date' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({
    description: 'Whether the rate is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
