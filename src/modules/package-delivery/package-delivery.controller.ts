import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { PackageDeliveryService } from './package-delivery.service';
import { CreatePackageDeliveryDto } from './dto/create-package-delivery.dto';
import { FilterPackageDeliveryDto } from './dto/filter-package-delivery.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { UserRole } from '@prisma/client';

@ApiTags('package-delivery')
@Controller('package-delivery')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PackageDeliveryController {
  constructor(
    private readonly packageDeliveryService: PackageDeliveryService,
  ) {}

  @Get()
  @Roles(UserRole.OPERATIONS_CLERK, UserRole.FINANCE_MANAGER, UserRole.PAYMENT_CLERK, UserRole.SUPER_ADMIN)
  @ApiOperation({
    description:
      'Retrieves all package delivery records with advanced filtering by customer, invoice, package, warehouse, packing list, date range, and more.',
  })
  @ApiResponse({
    status: 200,
    description: 'Deliveries retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              deliveryId: { type: 'string' },
              customerId: { type: 'string' },
              invoiceId: { type: 'string' },
              packageId: { type: 'string' },
              quantity: { type: 'number' },
              receiverName: { type: 'string', nullable: true },
              releaseDate: { type: 'string', format: 'date-time' },
              notes: { type: 'string', nullable: true },
              customer: { type: 'object' },
              invoice: { type: 'object' },
              package: { type: 'object' },
              createdBy: { type: 'object' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
            hasNextPage: { type: 'boolean' },
            hasPreviousPage: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions (requires OPERATIONS_CLERK role)',
  })
  findAll(@Query() filterDto: FilterPackageDeliveryDto) {
    const { page, limit, sortBy, sortOrder, ...filters } = filterDto;
    const paginationDto = { page, limit, sortBy, sortOrder };
    return this.packageDeliveryService.getAllDeliveries(paginationDto, filters);
  }

  @Post()
  @Roles(UserRole.OPERATIONS_CLERK, UserRole.FINANCE_MANAGER, UserRole.PAYMENT_CLERK, UserRole.SUPER_ADMIN)
  @ApiOperation({
    description:
      'Records when packages are picked up by the customer. Can handle multiple invoices and packages in a single pickup. If trackingCodes are not provided, all packages from the specified invoices will be picked up. Creates delivery records, updates package statuses to RELEASED, and sends pickup notifications.',
  })
  @ApiBody({
    type: CreatePackageDeliveryDto,
    description:
      'Pickup details including invoice IDs and optional tracking codes. If trackingCodes are omitted, all packages from the invoices will be picked up.',
  })
  @ApiResponse({
    status: 201,
    description: 'Pickup records created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        count: { type: 'number', example: 3 },
        deliveries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'uuid' },
              deliveryId: { type: 'string', example: 'DEL001-2025001' },
              invoiceId: { type: 'string' },
              packageId: { type: 'string' },
              trackingCode: { type: 'string', example: 'TR-2025-001' },
              quantity: { type: 'number', example: 1 },
              releaseDate: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or delivery not allowed',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions (requires OPERATIONS_CLERK role)',
  })
  async create(
    @Body() createPackageDeliveryDto: CreatePackageDeliveryDto,
    @Request() req: any,
  ) {
    return this.packageDeliveryService.createDelivery(
      createPackageDeliveryDto,
      req.user.id,
    );
  }

  @Get('by-invoice/:invoiceId')
  @Roles(UserRole.OPERATIONS_CLERK, UserRole.FINANCE_MANAGER, UserRole.PAYMENT_CLERK, UserRole.SUPER_ADMIN)
  @ApiOperation({
    description:
      'Retrieves all package deliveries associated with a specific invoice',
  })
  @ApiParam({
    name: 'invoiceId',
    description: 'Invoice UUID',
    example: 'uuid-invoice-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Deliveries retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          deliveryId: { type: 'string' },
          releaseDate: { type: 'string', format: 'date-time' },
          quantity: { type: 'number' },
          receiverName: { type: 'string', nullable: true },
          photos: { type: 'array', items: { type: 'string' } },
          package: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              trackingCode: { type: 'string' },
              warehouse: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions (requires OPERATIONS_CLERK role)',
  })
  async getDeliveriesByInvoice(@Param('invoiceId') invoiceId: string) {
    return this.packageDeliveryService.getDeliveriesByInvoice(invoiceId);
  }

  @Get('by-customer/:customerId')
  @Roles(UserRole.OPERATIONS_CLERK, UserRole.FINANCE_MANAGER, UserRole.PAYMENT_CLERK, UserRole.SUPER_ADMIN)
  @ApiOperation({
    description:
      'Retrieves all package item deliveries for a specific customer across all invoices',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer UUID',
    example: 'uuid-customer-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Deliveries retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          deliveryId: { type: 'string' },
          releaseDate: { type: 'string', format: 'date-time' },
          quantity: { type: 'number' },
          receiverName: { type: 'string', nullable: true },
          invoice: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              invoiceNumber: { type: 'string' },
              packingList: {
                type: 'object',
                properties: {
                  container: {
                    type: 'object',
                    properties: {
                      containerNumber: { type: 'string' },
                      destinationCity: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions (requires OPERATIONS_CLERK role)',
  })
  async getDeliveriesByCustomer(@Param('customerId') customerId: string) {
    return this.packageDeliveryService.getCustomerDeliveries(customerId);
  }

  @Get('by-id/:deliveryId')
  @Roles(UserRole.OPERATIONS_CLERK, UserRole.FINANCE_MANAGER, UserRole.PAYMENT_CLERK, UserRole.SUPER_ADMIN)
  @ApiOperation({
    description:
      'Retrieves detailed information for a specific delivery record',
  })
  @ApiParam({
    name: 'deliveryId',
    description: 'Delivery ID (not UUID)',
    example: 'DEL001-2025001',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        deliveryId: { type: 'string' },
        releaseDate: { type: 'string', format: 'date-time' },
        quantity: { type: 'number' },
        receiverName: { type: 'string', nullable: true },
        photos: { type: 'array', items: { type: 'string' } },
        customer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
        invoice: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            invoiceNumber: { type: 'string' },
            packingList: {
              type: 'object',
              properties: {
                container: {
                  type: 'object',
                  properties: {
                    containerNumber: { type: 'string' },
                    destinationCity: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        packageItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            intakeTrackingCode: { type: 'string' },
            description: { type: 'string' },
            package: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                trackingCode: { type: 'string' },
              },
            },
            warehouse: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                location: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions (requires OPERATIONS_CLERK role)',
  })
  async getDeliveryDetails(@Param('deliveryId') deliveryId: string) {
    return this.packageDeliveryService.getDeliveryById(deliveryId);
  }
}
