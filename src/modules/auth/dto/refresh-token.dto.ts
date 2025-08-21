import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token used to generate new access token',
    example: 'REDACTED_JWT...',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
