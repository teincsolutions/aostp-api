import { IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShippingMode, AirShippingType } from '@prisma/client';

export class CalculateShippingCostDto {
  @ApiProperty({
    description: 'Shipping mode',
    enum: ShippingMode,
    example: ShippingMode.SEA,
  })
  @IsEnum(ShippingMode)
  shippingMode: ShippingMode;

  @ApiPropertyOptional({
    description: 'Air shipping type (required if shipping mode is AIR)',
    enum: AirShippingType,
    example: AirShippingType.NORMAL_AIR,
  })
  @IsOptional()
  @IsEnum(AirShippingType)
  airShippingType?: AirShippingType;

  @ApiProperty({
    description: 'Weight in KG',
    minimum: 0.01,
    example: 10.5,
  })
  @IsNumber()
  @Min(0.01)
  weight: number;

  @ApiPropertyOptional({
    description: 'Cubic meters (required for sea shipping)',
    minimum: 0.001,
    example: 0.5,
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.001)
  cbm?: number;
}
