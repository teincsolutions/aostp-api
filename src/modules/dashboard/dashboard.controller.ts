import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({ summary: 'Get dashboard KPIs summary' })
  @ApiResponse({ status: 200, description: 'KPIs data retrieved successfully' })
  @ApiQuery({ type: DashboardFiltersDto })
  getKpis(@Query() filters: DashboardFiltersDto) {
    return this.dashboardService.getKpis(filters);
  }

  @Get('packages-by-status')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({ summary: 'Get packages count grouped by status' })
  @ApiResponse({
    status: 200,
    description: 'Packages by status data retrieved successfully',
  })
  @ApiQuery({ type: DashboardFiltersDto })
  getPackagesByStatus(@Query() filters: DashboardFiltersDto) {
    return this.dashboardService.getPackagesByStatus(filters);
  }

  @Get('packages-by-month')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({ summary: 'Get packages created per month time series' })
  @ApiResponse({
    status: 200,
    description: 'Packages by month data retrieved successfully',
  })
  @ApiQuery({ type: DashboardFiltersDto })
  getPackagesByMonth(@Query() filters: DashboardFiltersDto) {
    return this.dashboardService.getPackagesByMonth(filters);
  }

  @Get('revenue-trend')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({ summary: 'Get revenue trend time series' })
  @ApiResponse({
    status: 200,
    description: 'Revenue trend data retrieved successfully',
  })
  @ApiQuery({ type: DashboardFiltersDto })
  getRevenueTrend(@Query() filters: DashboardFiltersDto) {
    return this.dashboardService.getRevenueTrend(filters);
  }

  @Get('top-customers')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({ summary: 'Get top customers by revenue or shipment volume' })
  @ApiResponse({
    status: 200,
    description: 'Top customers data retrieved successfully',
  })
  @ApiQuery({ type: DashboardFiltersDto })
  getTopCustomers(@Query() filters: DashboardFiltersDto) {
    return this.dashboardService.getTopCustomers(filters);
  }

  @Get('recent-invoices')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({ summary: 'Get recent invoices with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Recent invoices data retrieved successfully',
  })
  @ApiQuery({ type: DashboardFiltersDto })
  getRecentInvoices(@Query() filters: DashboardFiltersDto) {
    return this.dashboardService.getRecentInvoices(filters);
  }

  @Get('aging-packages')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({ summary: 'Get packages that have stayed long in warehouse' })
  @ApiResponse({
    status: 200,
    description: 'Aging packages data retrieved successfully',
  })
  @ApiQuery({ type: DashboardFiltersDto })
  getAgingPackages(@Query() filters: DashboardFiltersDto) {
    return this.dashboardService.getAgingPackages(filters);
  }
}
