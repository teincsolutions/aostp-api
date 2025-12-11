import { ApiProperty } from '@nestjs/swagger';

export class PaymentMethodDataDto {
  @ApiProperty({ description: 'Payment method name', example: 'CASH' })
  method: string;

  @ApiProperty({ description: 'Total amount for this method', example: 30000 })
  amount: number;
}

export class PaymentMethodsResponseDto {
  @ApiProperty({
    description: 'Total amount across all methods',
    example: 50000,
  })
  total: number;

  @ApiProperty({
    description: 'Breakdown by payment method',
    type: [PaymentMethodDataDto],
  })
  methods: PaymentMethodDataDto[];
}
