import { ApiProperty } from '@nestjs/swagger';

export class CustomerRankingDto {
  @ApiProperty({ description: 'Customer code', example: 'CUST-001' })
  customerCode: string;

  @ApiProperty({ description: 'Customer full name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Value metric', example: 15000.0 })
  value: number;

  @ApiProperty({ description: 'Rank position', example: 1 })
  rank: number;
}

export class CustomerLeagueReportResponseDto {
  @ApiProperty({
    description: 'Top customers by invoice totals',
    type: [CustomerRankingDto],
  })
  topByInvoices: CustomerRankingDto[];

  @ApiProperty({
    description: 'Top customers by payment totals',
    type: [CustomerRankingDto],
  })
  topByPayments: CustomerRankingDto[];

  @ApiProperty({
    description: 'Top customers by total CBM',
    type: [CustomerRankingDto],
  })
  topByCbm: CustomerRankingDto[];

  @ApiProperty({
    description: 'Top customers by total weight',
    type: [CustomerRankingDto],
  })
  topByWeight: CustomerRankingDto[];
}
