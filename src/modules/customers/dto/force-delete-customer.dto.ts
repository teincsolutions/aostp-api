import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForceDeleteCustomerDto {
  @ApiProperty({
    description:
      'Full name of the customer to confirm deletion (must match exactly: "firstName lastName" or "firstName" if no last name)',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  confirmName: string;
}
