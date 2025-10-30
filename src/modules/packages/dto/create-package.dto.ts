import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  Min,
  IsNotEmpty,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShippingMode, AirShippingType, PackageStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreatePackagePhotoDto {
  @ApiProperty({ description: 'S3 URL of the photo' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ description: 'S3 key of the photo' })
  @IsString()
  @IsNotEmpty()
  key: string;
}

export class CreatePackageDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsUUID()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'Package description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Weight in KG', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({
    description: 'Cubic meters for sea shipping',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cbm?: number;

  @ApiProperty({ description: 'Quantity', default: 1, minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number = 1;

  @ApiPropertyOptional({
    description: 'Rate per unit (per CBM for SEA, per KG for AIR)',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingRate?: number;

  @ApiPropertyOptional({
    description: 'Currency for shipping rate',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  shippingCurrency?: string = 'USD';

  @ApiPropertyOptional({
    description: 'Pre-calculated shipping cost (rate * units * quantity)',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @ApiProperty({ enum: ShippingMode, description: 'Shipping mode' })
  @IsEnum(ShippingMode)
  shippingMode: ShippingMode;

  @ApiPropertyOptional({
    enum: AirShippingType,
    description: 'Air shipping type (required if shipping mode is AIR)',
  })
  @IsOptional()
  @IsEnum(AirShippingType)
  airShippingType?: AirShippingType;

  @ApiPropertyOptional({
    enum: PackageStatus,
    description: 'Initial package status',
    default: PackageStatus.RECEIVED,
  })
  @IsOptional()
  @IsEnum(PackageStatus)
  status?: PackageStatus = PackageStatus.RECEIVED;

  @ApiPropertyOptional({
    description: 'Warehouse ID for the package',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Destination city ID for this package',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  destinationCityId?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Package photos (minimum 1 required)',
    type: [CreatePackagePhotoDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one photo is required' })
  @Type(() => CreatePackagePhotoDto)
  photos: CreatePackagePhotoDto[];

  @ApiProperty({
    description: 'Tracking code for the package',
    example: 'PKG-123456789',
  })
  @IsString()
  @IsNotEmpty()
  trackingCode: string;
}
