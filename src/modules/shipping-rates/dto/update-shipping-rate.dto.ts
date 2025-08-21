import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateShippingRateDto {
  @ApiPropertyOptional({
    description: 'Rate per unit (CBM for sea, KG for air)',
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  ratePerUnit?: number;

  @ApiPropertyOptional({ description: 'Currency code' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Effective to date' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({ description: 'Whether the rate is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
