import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimalPlaces } from '../../../shared/validators/decimal.validator';

export class CreateExchangeRateDto {
  @ApiProperty({
    description: 'From currency code',
    default: 'USD',
    example: 'USD',
  })
  @IsString()
  @IsNotEmpty()
  fromCurrency: string = 'USD';

  @ApiProperty({
    description: 'To currency code',
    example: 'GHS',
  })
  @IsString()
  @IsNotEmpty()
  toCurrency: string;

  @ApiProperty({
    description: 'Exchange rate',
    minimum: 0,
    example: 12.5,
  })
  @IsNumber()
  @Min(0)
  @IsDecimalPlaces(2, {
    message: 'Exchange rate must have at most 2 decimal places',
  })
  rate: number;

  @ApiPropertyOptional({
    description: 'Effective from date (defaults to now)',
    example: '2024-01-15T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({
    description: 'Effective to date (null means indefinite)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
