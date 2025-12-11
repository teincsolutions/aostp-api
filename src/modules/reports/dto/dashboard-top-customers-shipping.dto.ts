import { ApiProperty } from '@nestjs/swagger';

export class TopCustomerShippingDto {
  @ApiProperty({ description: 'Customer code', example: 'C001' })
  customerCode: string;

  @ApiProperty({ description: 'Customer full name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Total CBM', example: 12.5 })
  cbm: number;

  @ApiProperty({ description: 'Total weight in KG', example: 120 })
  weight: number;

  @ApiProperty({ description: 'Rank position', example: 1 })
  rank: number;
}

export class TopCustomersShippingResponseDto {
  @ApiProperty({ description: 'Year of the data', example: 2025 })
  year: number;

  @ApiProperty({
    description: 'Top 10 customers by CBM',
    type: [TopCustomerShippingDto],
  })
  topByCbm: TopCustomerShippingDto[];

  @ApiProperty({
    description: 'Top 10 customers by weight',
    type: [TopCustomerShippingDto],
  })
  topByWeight: TopCustomerShippingDto[];
}
