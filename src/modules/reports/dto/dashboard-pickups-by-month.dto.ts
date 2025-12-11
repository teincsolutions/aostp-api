import { ApiProperty } from '@nestjs/swagger';

export class PickupsByMonthDataDto {
  @ApiProperty({ description: 'Month abbreviation', example: 'JAN' })
  month: string;

  @ApiProperty({ description: 'Count of pickups for the month', example: 80 })
  count: number;
}

export class PickupsByMonthResponseDto {
  @ApiProperty({ description: 'Year of the data', example: 2025 })
  year: number;

  @ApiProperty({
    description: 'Monthly pickup counts',
    type: [PickupsByMonthDataDto],
  })
  series: PickupsByMonthDataDto[];
}
