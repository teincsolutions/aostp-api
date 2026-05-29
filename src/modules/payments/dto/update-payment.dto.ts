import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePaymentDto {
  @ApiPropertyOptional({ description: 'Transaction reference number' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'S3 key for reference document' })
  @IsOptional()
  @IsString()
  referenceDocumentKey?: string;

  @ApiPropertyOptional({ description: 'Payment method' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}