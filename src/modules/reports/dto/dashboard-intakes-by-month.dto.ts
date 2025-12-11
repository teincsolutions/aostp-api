import { ApiProperty } from '@nestjs/swagger';

export class IntakesByMonthDataDto {
  @ApiProperty({ description: 'Month abbreviation', example: 'JAN' })
  month: string;

  @ApiProperty({ description: 'Count of intakes for the month', example: 210 })
  count: number;
}

export class IntakesByMonthResponseDto {
  @ApiProperty({ description: 'Year of the data', example: 2025 })
  year: number;

  @ApiProperty({
    description: 'Monthly intake counts',
    type: [IntakesByMonthDataDto],
  })
  series: IntakesByMonthDataDto[];
}
