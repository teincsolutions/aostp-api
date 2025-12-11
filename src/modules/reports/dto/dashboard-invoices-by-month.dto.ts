import { ApiProperty } from '@nestjs/swagger';

export class MonthlyDataDto {
  @ApiProperty({ description: 'Month abbreviation', example: 'JAN' })
  month: string;

  @ApiProperty({ description: 'Count for the month', example: 120 })
  count: number;
}

export class InvoicesByMonthResponseDto {
  @ApiProperty({ description: 'Year of the data', example: 2025 })
  year: number;

  @ApiProperty({
    description: 'Monthly invoice counts',
    type: [MonthlyDataDto],
  })
  series: MonthlyDataDto[];
}
