import {
  IsString,
  IsUUID,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimalPlaces } from '../../../shared/validators/decimal.validator';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'Packing list ID' })
  @IsUUID()
  packingListId: string;

  @ApiPropertyOptional({ description: 'Due date for the invoice' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Currency for the invoice',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Exchange rate to use', minimum: 0.01 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @IsDecimalPlaces(2, {
    message: 'Exchange rate must have at most 2 decimal places',
  })
  exchangeRate?: number;
}
