import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePackageDto } from './create-package.dto';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  Min,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PackageStatus, PaymentStatus } from '@prisma/client';

export class UpdatePackageDto extends PartialType(
  OmitType(CreatePackageDto, ['customerId', 'photos', 'trackingCode'] as const),
) {
  @ApiPropertyOptional({ enum: PackageStatus, description: 'Package status' })
  @IsOptional()
  @IsEnum(PackageStatus)
  status?: PackageStatus;

  @ApiPropertyOptional({
    description: 'Warehouse ID for the packing list',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Days in warehouse',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  daysInWarehouse?: number;

  @ApiPropertyOptional({ description: 'Packing list ID' })
  @IsOptional()
  @IsUUID()
  packingListId?: string;

  @ApiPropertyOptional({ description: 'Invoice ID' })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Payment status',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}
