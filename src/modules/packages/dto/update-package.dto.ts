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

  @ApiPropertyOptional({ description: 'Warehouse location' })
  @IsOptional()
  @IsString()
  warehouseLocation?: string;

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
