import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyTwoFactorDto {
  @ApiProperty({
    description: '6-digit verification code from authenticator app or SMS',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({
    description: 'Phone number for SMS backup codes',
    example: '+233501234567',
  })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;
}
