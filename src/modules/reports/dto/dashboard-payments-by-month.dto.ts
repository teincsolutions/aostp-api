import { ApiProperty } from '@nestjs/swagger';

export class PaymentsByMonthDataDto {
  @ApiProperty({ description: 'Month abbreviation', example: 'JAN' })
  month: string;

  @ApiProperty({
    description: 'Total AIR payments for the month',
    example: 10000,
  })
  air: number;

  @ApiProperty({
    description: 'Total SEA payments for the month',
    example: 8000,
  })
  sea: number;
}

export class PaymentsByMonthResponseDto {
  @ApiProperty({ description: 'Year of the data', example: 2025 })
  year: number;

  @ApiProperty({
    description: 'Monthly payments by shipping mode',
    type: [PaymentsByMonthDataDto],
  })
  series: PaymentsByMonthDataDto[];
}
