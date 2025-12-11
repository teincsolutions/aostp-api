import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatsDto } from './packing-list-report.dto';

export class WarehousePackingListDto {
  @ApiProperty({
    description: 'Packing list ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({ description: 'Packing list name', example: 'PL-2025-001' })
  name: string;

  @ApiProperty({ description: 'Total packages in packing list', example: 50 })
  totalPackages: number;
}

export class WarehouseStatsDto {
  @ApiProperty({
    description: 'Warehouse ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({ description: 'Warehouse name', example: 'China Main' })
  name: string;

  @ApiProperty({ description: 'Total packages in warehouse', example: 250 })
  totalPackages: number;

  @ApiProperty({ description: 'Total unique customers', example: 75 })
  totalCustomers: number;

  @ApiProperty({ description: 'Total weight in KG', example: 5000.0 })
  totalWeight: number;

  @ApiProperty({ description: 'Total CBM', example: 150.5 })
  totalCBM: number;

  @ApiProperty({ description: 'Number of outstanding invoices', example: 30 })
  outstandingInvoices: number;

  @ApiProperty({ description: 'Outstanding invoice amount', example: 25000.0 })
  outstandingAmount: number;

  @ApiProperty({
    description: 'Packing lists associated with warehouse',
    type: [WarehousePackingListDto],
  })
  packingLists: WarehousePackingListDto[];
}

export class WarehouseReportResponseDto {
  @ApiProperty({
    description: 'Statistics by warehouse',
    type: [WarehouseStatsDto],
  })
  warehouses: WarehouseStatsDto[];

  @ApiProperty({ description: 'Overall total packages', example: 1000 })
  totalPackages: number;

  @ApiProperty({ description: 'Overall total customers', example: 300 })
  totalCustomers: number;

  @ApiProperty({ description: 'Overall total weight', example: 20000.0 })
  totalWeight: number;

  @ApiProperty({ description: 'Overall total CBM', example: 600.5 })
  totalCBM: number;
}
