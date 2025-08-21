import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateExchangeRateDto } from './create-exchange-rate.dto';
import {
  IsOptional,
  IsBoolean,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateExchangeRateDto extends PartialType(
  OmitType(CreateExchangeRateDto, ['fromCurrency', 'toCurrency'] as const),
) {
  @ApiPropertyOptional({
    description: 'Exchange rate',
    minimum: 0,
    example: 13.2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @ApiPropertyOptional({
    description: 'Effective to date',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({
    description: 'Whether the rate is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
