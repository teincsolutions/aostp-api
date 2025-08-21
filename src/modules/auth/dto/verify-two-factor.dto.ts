import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyTwoFactorDto {
  @ApiProperty({
    description: '6-digit verification code from authenticator app or SMS',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
