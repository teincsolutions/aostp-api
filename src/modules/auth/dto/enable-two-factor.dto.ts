import { IsOptional, IsPhoneNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EnableTwoFactorDto {
  @ApiPropertyOptional({
    description: 'Phone number for SMS backup codes',
    example: '+233501234567',
  })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;
}
