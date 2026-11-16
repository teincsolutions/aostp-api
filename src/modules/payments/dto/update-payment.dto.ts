import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const PAYMENT_METHODS = [
  'CASH',
  'BANK_TRANSFER',
  'MOBILE_MONEY',
  'CARD',
  'CREDIT_CARD',
  'DIRECT_MOMO_TRANSFER',
] as const;

export class UpdatePaymentDto {
  @ApiPropertyOptional({
    description: 'Payment method',
    enum: PAYMENT_METHODS,
    example: 'DIRECT_MOMO_TRANSFER',
  })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Transaction reference number' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'S3 key for the payment reference document',
  })
  @IsOptional()
  @IsString()
  referenceDocumentKey?: string;
}
