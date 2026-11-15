import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiProduces,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerFilterDto } from './dto/customer-filter.dto';
import { ExportCustomersDto } from './dto/export-customers.dto';
import { ForceDeleteCustomerDto } from './dto/force-delete-customer.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.PAYMENT_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  @ApiOperation({
    summary: 'Create a new customer',
    description:
      'Create a new customer record with contact information and preferences',
  })
  @ApiBody({ type: CreateCustomerDto })
  @ApiResponse({
    status: 201,
    description: 'Customer created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        customerCode: { type: 'string', example: 'CUST-2024-001' },
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
        email: { type: 'string', example: 'john.doe@example.com' },
        phoneNumber: { type: 'string', example: '+233501234567' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  create(@Body() createCustomerDto: CreateCustomerDto, @Request() req: any) {
    return this.customersService.create(createCustomerDto, req.user?.id);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.PAYMENT_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  @ApiOperation({
    summary: 'Get all customers with pagination',
    description: 'Retrieve a paginated list of customers with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Customers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              customerCode: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string' },
              phoneNumber: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
              isActive: { type: 'boolean' },
            },
          },
        },
        totalItems: { type: 'number' },
        totalPages: { type: 'number' },
        currentPage: { type: 'number' },
        itemsPerPage: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  findAll(@Query() filterDto: CustomerFilterDto) {
    const { search, isActive, ...paginationDto } = filterDto;
    const filters = {
      search,
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    };
    return this.customersService.findAll(paginationDto, filters);
  }

  @Get('export')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.PAYMENT_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  @ApiOperation({
    summary: 'Export customers',
    description:
      'Downloads the filtered customer list, or a specific set of customers, as a PDF or Excel file. ' +
      'When ids are supplied, other filters are ignored. Exports are capped at 5000 customers.',
  })
  @ApiProduces(
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiResponse({ status: 200, description: 'Export file generated' })
  @ApiResponse({ status: 400, description: 'Invalid export parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async export(
    @Query() exportDto: ExportCustomersDto,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.customersService.exportCustomers(exportDto);

    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Length': file.buffer.length.toString(),
      'Cache-Control': 'no-store',
    });

    res.end(file.buffer);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.PAYMENT_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  @ApiOperation({
    summary: 'Get customer by ID',
    description: 'Retrieve a single customer by their unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Customer unique identifier',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer found',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        customerCode: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string' },
        phoneNumber: { type: 'string' },
        alternatePhone: { type: 'string' },
        address: { type: 'string' },
        city: { type: 'string' },
        country: { type: 'string' },
        idType: {
          type: 'string',
          enum: ['NATIONAL_ID', 'PASSPORT', 'DRIVERS_LICENSE', 'OTHER'],
        },
        idNumber: { type: 'string' },
        preferredChannel: {
          type: 'string',
          enum: ['EMAIL', 'SMS', 'WHATSAPP'],
        },
        isActive: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Get('code/:customerCode')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.PAYMENT_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  @ApiOperation({
    summary: 'Get customer by code',
    description: 'Retrieve a customer by their unique customer code',
  })
  @ApiParam({
    name: 'customerCode',
    description: 'Customer code (e.g., CUST-2024-001)',
    type: 'string',
  })
  @ApiResponse({ status: 200, description: 'Customer found' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findByCode(@Param('customerCode') customerCode: string) {
    return this.customersService.findByCode(customerCode);
  }

  @Get('phone/:phoneNumber')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.PAYMENT_CLERK,
  )
  @ApiOperation({
    summary: 'Get customer by phone number',
    description: 'Retrieve a customer by their phone number',
  })
  @ApiParam({
    name: 'phoneNumber',
    description: 'Customer phone number',
    type: 'string',
  })
  @ApiResponse({ status: 200, description: 'Customer found' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findByPhone(@Param('phoneNumber') phoneNumber: string) {
    return this.customersService.findByPhone(phoneNumber);
  }

  @Get(':id/stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @ApiOperation({
    summary: 'Get customer statistics',
    description:
      'Retrieve statistics for a specific customer including package counts, revenue, etc.',
  })
  @ApiParam({
    name: 'id',
    description: 'Customer unique identifier',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer statistics retrieved',
    schema: {
      type: 'object',
      properties: {
        totalPackages: { type: 'number', example: 25 },
        totalRevenue: { type: 'number', example: 1500.5 },
        pendingPayments: { type: 'number', example: 300.0 },
        lastOrderDate: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getCustomerStats(@Param('id') id: string) {
    return this.customersService.getCustomerStats(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({
    summary: 'Update customer',
    description: 'Update customer information',
  })
  @ApiParam({
    name: 'id',
    description: 'Customer unique identifier',
    type: 'string',
  })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Request() req: any,
  ) {
    return this.customersService.update(id, updateCustomerDto, req.user?.id);
  }

  @Delete(':id/force')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Force delete a customer and all related data',
    description:
      'Permanently and irreversibly deletes a customer along with all associated records ' +
      '(packages, package items, invoices, payments, deliveries, notifications). ' +
      'Requires the caller to confirm the customer full name in the request body. ' +
      'Restricted to SUPER_ADMIN only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Customer unique identifier',
    type: 'string',
  })
  @ApiBody({ type: ForceDeleteCustomerDto })
  @ApiResponse({
    status: 200,
    description: 'Customer and all related records permanently deleted',
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean', example: true },
        summary: {
          type: 'object',
          properties: {
            packageDeliveries: { type: 'number', example: 3 },
            payments: { type: 'number', example: 5 },
            notifications: { type: 'number', example: 12 },
            invoices: { type: 'number', example: 4 },
            packageItems: { type: 'number', example: 8 },
            packages: { type: 'number', example: 4 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Confirmation name does not match' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - SUPER_ADMIN only' })
  forceDelete(
    @Param('id') id: string,
    @Body() forceDeleteDto: ForceDeleteCustomerDto,
    @Request() req: any,
  ) {
    return this.customersService.forceDelete(
      id,
      forceDeleteDto.confirmName,
      req.user?.id,
    );
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete customer',
    description: 'Permanently delete a customer record (only for SUPER_ADMIN)',
  })
  @ApiParam({
    name: 'id',
    description: 'Customer unique identifier',
    type: 'string',
  })
  @ApiResponse({ status: 200, description: 'Customer deleted successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.customersService.remove(id, req.user?.id);
  }
}
