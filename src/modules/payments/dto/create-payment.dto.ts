import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'Payment amount', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Currency code', default: 'USD' })
  @IsString()
  currency: string = 'USD';

  @ApiProperty({ description: 'Exchange rate ID to use for conversion' })
  @IsUUID()
  exchangeRateId: string;

  @ApiProperty({
    description: 'Payment method',
    examples: ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CREDIT_CARD'],
  })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({ description: 'Transaction reference number' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Invoice IDs to apply payment to',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  invoiceIds?: string[];

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
