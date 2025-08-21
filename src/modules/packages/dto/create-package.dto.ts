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

  @ApiProperty({ description: 'Weight in KG', minimum: 0 })
  @IsNumber()
  @Min(0)
  weight: number;

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

  @ApiPropertyOptional({ description: 'Package value', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

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

  @ApiPropertyOptional({ description: 'Warehouse location' })
  @IsOptional()
  @IsString()
  warehouseLocation?: string;

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

  @ApiPropertyOptional({
    description: 'Custom tracking code (auto-generated if not provided)',
  })
  @IsOptional()
  @IsString()
  trackingCode?: string;
}
