import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/common.dto';
import {
  DashboardQueryDto,
  RecentItemsQueryDto,
} from './dto/dashboard-common.dto';
import { PaymentsReportResponseDto } from './dto/payments-report.dto';
import { PackingListReportResponseDto } from './dto/packing-list-report.dto';
import { CustomerLeagueReportResponseDto } from './dto/customer-league-report.dto';
import { ShippingMethodReportResponseDto } from './dto/shipping-method-report.dto';
import { GeneralReportResponseDto } from './dto/general-report.dto';
import { PickupReportResponseDto } from './dto/pickup-report.dto';
import { WarehouseReportResponseDto } from './dto/warehouse-report.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('payments')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get payments report',
    description:
      'Returns list of all payments across warehouses with totals by currency',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Filter by start date (ISO 8601 format)',
    example: '2025-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Filter by end date (ISO 8601 format)',
    example: '2025-12-31T23:59:59Z',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiQuery({
    name: 'shippingMode',
    required: false,
    enum: ['SEA', 'AIR'],
    description: 'Filter by shipping mode',
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: String,
    description: 'Filter by customer ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Payments report generated successfully',
    type: PaymentsReportResponseDto,
  })
  async getPaymentsReport(
    @Query() query: ReportQueryDto,
  ): Promise<PaymentsReportResponseDto> {
    return this.reportsService.getPaymentsReport(query);
  }

  @Get('packing-lists')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get packing list report',
    description:
      'Returns invoice statistics for packing lists including paid/unpaid/partial breakdown',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Filter by start date',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Filter by end date',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Packing list report generated successfully',
    type: PackingListReportResponseDto,
  })
  async getPackingListReport(
    @Query() query: ReportQueryDto,
  ): Promise<PackingListReportResponseDto> {
    return this.reportsService.getPackingListReport(query);
  }

  @Get('customer-league')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @ApiOperation({
    summary: 'Get customer league report',
    description:
      'Returns top customers ranked by invoice totals, payment totals, CBM, and weight',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Filter by start date',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Filter by end date',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: String,
    description: 'Filter by customer ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer league report generated successfully',
    type: CustomerLeagueReportResponseDto,
  })
  async getCustomerLeagueReport(
    @Query() query: ReportQueryDto,
  ): Promise<CustomerLeagueReportResponseDto> {
    return this.reportsService.getCustomerLeagueReport(query);
  }

  @Get('shipping-method')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get shipping method report',
    description:
      'Returns revenue, invoice count, and top customers by shipping method (AIR/SEA)',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Filter by start date',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Filter by end date',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Shipping method report generated successfully',
    type: ShippingMethodReportResponseDto,
  })
  async getShippingMethodReport(
    @Query() query: ReportQueryDto,
  ): Promise<ShippingMethodReportResponseDto> {
    return this.reportsService.getShippingMethodReport(query);
  }

  @Get('general')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @ApiOperation({
    summary: 'Get general report',
    description:
      'Returns comprehensive customer metrics including pickup rate, shipping methods, and transaction history',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Filter by start date',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Filter by end date',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: String,
    description: 'Filter by customer ID',
  })
  @ApiResponse({
    status: 200,
    description: 'General report generated successfully',
    type: GeneralReportResponseDto,
  })
  async getGeneralReport(
    @Query() query: ReportQueryDto,
  ): Promise<GeneralReportResponseDto> {
    return this.reportsService.getGeneralReport(query);
  }

  @Get('pickups')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get pickup report',
    description:
      'Returns package delivery records with customer, invoice, and package details',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Filter by start date',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Filter by end date',
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: String,
    description: 'Filter by customer ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Pickup report generated successfully',
    type: PickupReportResponseDto,
  })
  async getPickupReport(
    @Query() query: ReportQueryDto,
  ): Promise<PickupReportResponseDto> {
    return this.reportsService.getPickupReport(query);
  }

  @Get('warehouses')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @ApiOperation({
    summary: 'Get warehouse report',
    description:
      'Returns statistics by warehouse including packages, customers, weight, CBM, and outstanding invoices',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'Filter by start date',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'Filter by end date',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by specific warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Warehouse report generated successfully',
    type: WarehouseReportResponseDto,
  })
  async getWarehouseReport(
    @Query() query: ReportQueryDto,
  ): Promise<WarehouseReportResponseDto> {
    return this.reportsService.getWarehouseReport(query);
  }

  /**
   * DASHBOARD GRAPH ENDPOINTS
   */

  @Get('dashboard/invoices-by-month')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get invoices by month graph data',
    description: 'Returns monthly invoice counts for bar/line charts',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year for the report (defaults to current year)',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoices by month data generated successfully',
  })
  async getInvoicesByMonth(@Query() query: DashboardQueryDto) {
    return this.reportsService.getInvoicesByMonth(query);
  }

  @Get('dashboard/payments-by-month')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get payments by month graph data (AIR vs SEA)',
    description:
      'Returns monthly payment totals grouped by shipping mode for comparison charts',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year for the report',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Payments by month data generated successfully',
  })
  async getPaymentsByMonth(@Query() query: DashboardQueryDto) {
    return this.reportsService.getPaymentsByMonth(query);
  }

  @Get('dashboard/intakes-by-month')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get intakes by month graph data',
    description:
      'Returns monthly package intake counts for operations dashboard',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year for the report',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Intakes by month data generated successfully',
  })
  async getIntakesByMonth(@Query() query: DashboardQueryDto) {
    return this.reportsService.getIntakesByMonth(query);
  }

  @Get('dashboard/pickups-by-month')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get pickups by month graph data',
    description: 'Returns monthly package pickup/delivery counts',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year for the report',
  })
  @ApiResponse({
    status: 200,
    description: 'Pickups by month data generated successfully',
  })
  async getPickupsByMonth(@Query() query: DashboardQueryDto) {
    return this.reportsService.getPickupsByMonth(query);
  }

  @Get('dashboard/payment-methods')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @ApiOperation({
    summary: 'Get payment method breakdown',
    description:
      'Returns payment totals grouped by payment method (CASH, MOMO, etc.)',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year for the report',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment methods breakdown generated successfully',
  })
  async getPaymentMethods(@Query() query: DashboardQueryDto) {
    return this.reportsService.getPaymentMethods(query);
  }

  @Get('dashboard/shipping-modes')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get shipping mode summary',
    description: 'Returns count of packages by shipping mode (AIR vs SEA)',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year for the report',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Shipping modes summary generated successfully',
  })
  async getShippingModes(@Query() query: DashboardQueryDto) {
    return this.reportsService.getShippingModes(query);
  }

  @Get('dashboard/top-customers-by-amount')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @ApiOperation({
    summary: 'Get top 10 customers by amount',
    description:
      'Returns top customers ranked by total invoice amount with payment status',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year for the report',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Top customers by amount generated successfully',
  })
  async getTopCustomersByAmount(@Query() query: DashboardQueryDto) {
    return this.reportsService.getTopCustomersByAmount(query);
  }

  @Get('dashboard/top-customers-shipping')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @ApiOperation({
    summary: 'Get top 10 customers by shipping metrics',
    description: 'Returns top customers ranked by CBM and weight separately',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year for the report',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Top customers by shipping generated successfully',
  })
  async getTopCustomersShipping(@Query() query: DashboardQueryDto) {
    return this.reportsService.getTopCustomersShipping(query);
  }

  @Get('dashboard/recent-intakes')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get recent intakes',
    description: 'Returns last 20 package intakes with pagination support',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items to return (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor for pagination',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent intakes fetched successfully',
  })
  async getRecentIntakes(@Query() query: RecentItemsQueryDto) {
    return this.reportsService.getRecentIntakes(query);
  }

  @Get('dashboard/recent-invoices-payments')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get recent invoices with payment status',
    description:
      'Returns last 20 invoices with payment counts and balance information',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items to return',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor for pagination',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent invoices and payments fetched successfully',
  })
  async getRecentInvoicesPayments(@Query() query: RecentItemsQueryDto) {
    return this.reportsService.getRecentInvoicesPayments(query);
  }

  @Get('dashboard/recent-aged-packages')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get recent aged packages',
    description:
      'Returns packages not yet released, ordered by days in warehouse',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items to return',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor for pagination',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent aged packages fetched successfully',
  })
  async getRecentAgedPackages(@Query() query: RecentItemsQueryDto) {
    return this.reportsService.getRecentAgedPackages(query);
  }

  @Get('dashboard/recent-packing-lists')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get recent packing lists',
    description: 'Returns last 20 packing lists with container information',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items to return',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor for pagination',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    type: String,
    description: 'Filter by warehouse ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent packing lists fetched successfully',
  })
  async getRecentPackingLists(@Query() query: RecentItemsQueryDto) {
    return this.reportsService.getRecentPackingLists(query);
  }

  @Get('dashboard/recent-pickups')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({
    summary: 'Get recent pickups',
    description: 'Returns last 20 package deliveries/pickups',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items to return',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor for pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent pickups fetched successfully',
  })
  async getRecentPickups(@Query() query: RecentItemsQueryDto) {
    return this.reportsService.getRecentPickups(query);
  }
}
