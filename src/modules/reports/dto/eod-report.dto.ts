import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

// ─── Query ────────────────────────────────────────────────────────────────────

export class EodReportQueryDto {
  @ApiPropertyOptional({
    description:
      'Date for the EOD report (YYYY-MM-DD). Defaults to today (UTC). Ignored when fromDate/toDate are provided.',
    example: '2026-02-27',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Override range start (ISO 8601). Takes precedence over date.',
    example: '2026-02-27T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Override range end (ISO 8601). Takes precedence over date.',
    example: '2026-02-27T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by warehouse ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    description: 'Filter activities by a specific staff user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export class EodPaymentMethodDto {
  @ApiProperty({ description: 'Payment method name', example: 'MOBILE_MONEY' })
  method: string;

  @ApiProperty({ description: 'Number of transactions', example: 5 })
  count: number;

  @ApiProperty({
    description: 'Total amount collected in GHS (local currency)',
    example: 7500.0,
  })
  totalGhs: number;

  @ApiProperty({
    description: 'Total amount collected in USD',
    example: 500.0,
  })
  totalUsd: number;
}

export class EodWarehousePaymentsDto {
  @ApiProperty({ description: 'Total number of payment transactions', example: 12 })
  count: number;

  @ApiProperty({ description: 'Total collected in USD', example: 1200.0 })
  totalUsd: number;

  @ApiProperty({ description: 'Total collected in GHS (local)', example: 18000.0 })
  totalGhs: number;

  @ApiProperty({
    description: 'Breakdown by all payment methods',
    type: [EodPaymentMethodDto],
  })
  byMethod: EodPaymentMethodDto[];
}

// ─── Pickups ──────────────────────────────────────────────────────────────────

export class EodUserPickupDto {
  @ApiProperty({ description: 'Staff user ID' })
  userId: string;

  @ApiProperty({ description: 'Staff full name', example: 'John Staff' })
  userName: string;

  @ApiProperty({ description: 'Number of pickup transactions', example: 4 })
  count: number;

  @ApiProperty({ description: 'Total packages/items released', example: 10 })
  totalQuantity: number;
}

export class EodWarehousePickupsDto {
  @ApiProperty({ description: 'Total number of pickup transactions', example: 8 })
  count: number;

  @ApiProperty({ description: 'Total package quantity released', example: 20 })
  totalQuantity: number;

  @ApiProperty({
    description: 'Pickup breakdown by staff user',
    type: [EodUserPickupDto],
  })
  byUser: EodUserPickupDto[];
}

// ─── Intakes ──────────────────────────────────────────────────────────────────

export class EodUserIntakeDto {
  @ApiProperty({ description: 'Staff user ID' })
  userId: string;

  @ApiProperty({ description: 'Staff full name', example: 'Jane Staff' })
  userName: string;

  @ApiProperty({ description: 'Number of packages received', example: 6 })
  count: number;

  @ApiProperty({ description: 'Total item quantity received', example: 15 })
  totalQuantity: number;
}

export class EodWarehouseIntakesDto {
  @ApiProperty({ description: 'Number of packages received today', example: 15 })
  count: number;

  @ApiProperty({ description: 'Total item quantity received', example: 35 })
  totalQuantity: number;

  @ApiProperty({
    description: 'Intake breakdown by staff user',
    type: [EodUserIntakeDto],
  })
  byUser: EodUserIntakeDto[];
}

// ─── Per-warehouse breakdown ───────────────────────────────────────────────────

export class EodWarehouseBreakdownDto {
  @ApiProperty({ description: 'Warehouse ID' })
  warehouseId: string;

  @ApiProperty({ description: 'Warehouse name', example: 'China Main' })
  warehouseName: string;

  @ApiProperty({
    description: 'Payment collections for this warehouse',
    type: EodWarehousePaymentsDto,
  })
  payments: EodWarehousePaymentsDto;

  @ApiProperty({
    description: 'Pickups/deliveries for this warehouse',
    type: EodWarehousePickupsDto,
  })
  pickups: EodWarehousePickupsDto;

  @ApiProperty({
    description: 'Package intakes for this warehouse',
    type: EodWarehouseIntakesDto,
  })
  intakes: EodWarehouseIntakesDto;
}

// ─── User activity ────────────────────────────────────────────────────────────

export class EodUserActivityDto {
  @ApiProperty({ description: 'Staff user ID' })
  userId: string;

  @ApiProperty({ description: 'Staff full name', example: 'John Staff' })
  userName: string;

  @ApiProperty({ description: 'User role', example: 'OPERATIONS_CLERK' })
  role: string;

  @ApiPropertyOptional({ description: 'Warehouse the user belongs to' })
  warehouse?: string;

  @ApiProperty({ description: 'Number of payments processed', example: 5 })
  paymentsProcessed: number;

  @ApiProperty({
    description: 'Total GHS collected from payments processed',
    example: 7500.0,
  })
  paymentsTotalGhs: number;

  @ApiProperty({
    description: 'Total USD collected from payments processed',
    example: 500.0,
  })
  paymentsTotalUsd: number;

  @ApiProperty({ description: 'Number of packages received (intakes)', example: 8 })
  packagesReceived: number;

  @ApiProperty({ description: 'Item quantity received', example: 20 })
  intakeQuantity: number;

  @ApiProperty({ description: 'Number of pickup transactions released', example: 4 })
  pickupsReleased: number;

  @ApiProperty({ description: 'Total pickup item quantity released', example: 10 })
  pickupQuantity: number;
}

// ─── Overall summary ──────────────────────────────────────────────────────────

export class EodOverallSummaryDto {
  @ApiProperty({ description: 'Total payment transactions', example: 30 })
  totalPayments: number;

  @ApiProperty({ description: 'Grand total collected in USD', example: 3000.0 })
  totalRevenueUsd: number;

  @ApiProperty({ description: 'Grand total collected in GHS', example: 45000.0 })
  totalRevenueGhs: number;

  @ApiProperty({ description: 'Total pickup transactions', example: 20 })
  totalPickups: number;

  @ApiProperty({ description: 'Total items released via pickups', example: 50 })
  totalPickupQuantity: number;

  @ApiProperty({ description: 'Total packages received (intakes)', example: 40 })
  totalIntakes: number;

  @ApiProperty({ description: 'Total item quantity received', example: 80 })
  totalIntakeQuantity: number;

  @ApiProperty({ description: 'Total invoices created', example: 35 })
  totalInvoicesCreated: number;

  @ApiProperty({ description: 'Sum of all invoice amounts created', example: 15000.0 })
  totalInvoiceAmount: number;
}

// ─── Top-level response ───────────────────────────────────────────────────────

export class EodReportResponseDto {
  @ApiProperty({
    description: 'The date this report covers (YYYY-MM-DD)',
    example: '2026-02-27',
  })
  reportDate: string;

  @ApiProperty({ description: 'Report window start (inclusive)', example: '2026-02-27T00:00:00.000Z' })
  fromDate: Date;

  @ApiProperty({ description: 'Report window end (inclusive)', example: '2026-02-27T23:59:59.999Z' })
  toDate: Date;

  @ApiProperty({
    description: 'Per-warehouse breakdown of payments, pickups and intakes',
    type: [EodWarehouseBreakdownDto],
  })
  warehouses: EodWarehouseBreakdownDto[];

  @ApiProperty({
    description: 'Overall aggregated totals across all warehouses',
    type: EodOverallSummaryDto,
  })
  overall: EodOverallSummaryDto;

  @ApiProperty({
    description: "Activity summary per staff user for the day",
    type: [EodUserActivityDto],
  })
  activityByUser: EodUserActivityDto[];

  @ApiProperty({ description: 'Timestamp when the report was generated' })
  generatedAt: Date;
}
