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
}
