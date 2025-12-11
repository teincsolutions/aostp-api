import { ApiProperty } from '@nestjs/swagger';

export class TopCustomerByAmountDto {
  @ApiProperty({ description: 'Customer code', example: 'C001' })
  customerCode: string;

  @ApiProperty({ description: 'Customer full name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Total invoice amount', example: 5000 })
  totalAmount: number;

  @ApiProperty({ description: 'Total paid amount', example: 3000 })
  totalPaid: number;

  @ApiProperty({ description: 'Outstanding balance', example: 2000 })
  balance: number;

  @ApiProperty({ description: 'Number of invoices', example: 15 })
  invoiceCount: number;
}

export class TopCustomersByAmountResponseDto {
  @ApiProperty({ description: 'Year of the data', example: 2025 })
  year: number;

  @ApiProperty({
    description: 'Top 10 customers by amount',
    type: [TopCustomerByAmountDto],
  })
  top: TopCustomerByAmountDto[];
}
