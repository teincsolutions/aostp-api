import { PartialType } from '@nestjs/swagger';
import { CreateCustomerDto } from './create-customer.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @ApiPropertyOptional({
    description: 'Customer active status',
    example: true,
    type: 'boolean',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
