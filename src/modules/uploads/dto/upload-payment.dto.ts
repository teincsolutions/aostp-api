import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BucketType } from './index';

export enum PaymentFolder {
  REFERENCE_DOCUMENTS = 'reference-documents',
}

export class UploadPaymentDto {
  @ApiPropertyOptional({
    enum: BucketType,
    description: 'Type of bucket to upload to',
    example: BucketType.PACKAGES,
  })
  @IsEnum(BucketType)
  @IsOptional()
  bucketType?: BucketType;

  @ApiPropertyOptional({
    type: String,
    description: 'Original file name',
    example: 'payment-reference.pdf',
  })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiProperty({
    enum: PaymentFolder,
    description: 'Folder to upload the file to',
    example: PaymentFolder.REFERENCE_DOCUMENTS,
  })
  @IsEnum(PaymentFolder)
  folder: PaymentFolder;

  @ApiProperty({
    type: String,
    description: 'UUID of the payment',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  paymentId: string;
}
