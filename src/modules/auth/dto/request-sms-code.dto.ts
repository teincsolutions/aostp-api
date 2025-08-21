import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestSmsCodeDto {
  @ApiProperty({
    description: 'User ID to send SMS code to',
    example: 'uuid-string',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
