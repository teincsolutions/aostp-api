import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ShippingMode, AirShippingType } from '@prisma/client';

export class ShippingRatePathParamsDto {
  @ApiProperty({
    description: 'Shipping mode',
    enum: ShippingMode,
    example: ShippingMode.SEA,
  })
  @IsEnum(ShippingMode)
  shippingMode: ShippingMode;
}

export class ShippingRateQueryParamsDto {
  @ApiProperty({
    description: 'Air shipping type',
    enum: AirShippingType,
    example: AirShippingType.NORMAL_AIR,
    required: false,
  })
  @IsOptional()
  @IsEnum(AirShippingType)
  airShippingType?: AirShippingType;

  @ApiProperty({
    description: 'Maximum number of historical rates to return',
    minimum: 1,
    maximum: 100,
    default: 50,
    required: false,
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 50;
}
