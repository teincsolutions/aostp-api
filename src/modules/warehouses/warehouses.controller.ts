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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiParam,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { UserRole } from '@prisma/client';

@ApiTags('warehouses')
@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({
    summary: 'Create a new warehouse location',
    description:
      'Creates a new warehouse with auto-generated warehouse ID (WH001, WH002, etc.) for package intake and storage management',
  })
  @ApiBody({
    type: CreateWarehouseDto,
    description:
      'Warehouse creation details including name, location, and contact information',
  })
  @ApiResponse({
    status: 201,
    description: 'Warehouse created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid' },
        warehouseId: { type: 'string', example: 'WH001' },
        name: { type: 'string', example: 'China Main' },
        location: { type: 'string', example: 'Shenzhen, China' },
        contactInfo: { type: 'string', example: '+86 123 456 7890' },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or warehouse name already exists',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description:
      'Insufficient permissions (requires SUPER_ADMIN or OPERATIONS_CLERK role)',
  })
  async create(
    @Body() createWarehouseDto: CreateWarehouseDto,
    @Request() req: any,
  ) {
    return this.warehousesService.create(createWarehouseDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({
    summary: 'List warehouses with filtering and pagination',
    description:
      'Retrieves warehouses with optional filtering by status and search terms, supports pagination',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive', 'all'],
    description: 'Filter by warehouse status',
    example: 'active',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by warehouse name, location, or contact info',
    example: 'China',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: 'number',
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Number of items per page',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Warehouses retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              warehouseId: { type: 'string' },
              name: { type: 'string' },
              location: { type: 'string' },
              contactInfo: { type: 'string' },
              isActive: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
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
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description:
      'Insufficient permissions (requires SUPER_ADMIN or OPERATIONS_CLERK role)',
  })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: 'active' | 'inactive' | 'all',
    @Query('search') search?: string,
  ) {
    return this.warehousesService.findAll(paginationDto, { status, search });
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({
    summary: 'Get warehouse by ID',
    description: 'Retrieves detailed information about a specific warehouse',
  })
  @ApiParam({
    name: 'id',
    description: 'Warehouse UUID',
    example: 'uuid-warehouse-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Warehouse found and returned successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-warehouse-123' },
        warehouseId: { type: 'string', example: 'WH001' },
        name: { type: 'string', example: 'China Main' },
        location: { type: 'string', example: 'Shenzhen, China' },
        contactInfo: {
          type: 'string',
          nullable: true,
          example: '+86 123 456 7890',
        },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description:
      'Insufficient permissions (requires SUPER_ADMIN or OPERATIONS_CLERK role)',
  })
  async findOne(@Param('id') id: string) {
    return this.warehousesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({
    summary: 'Update warehouse information',
    description:
      'Updates warehouse details. Name changes are validated for uniqueness.',
  })
  @ApiParam({
    name: 'id',
    description: 'Warehouse UUID',
    example: 'uuid-warehouse-123',
  })
  @ApiBody({
    type: UpdateWarehouseDto,
    description: 'Warehouse update details (all fields optional)',
  })
  @ApiResponse({
    status: 200,
    description: 'Warehouse updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        warehouseId: { type: 'string' },
        name: { type: 'string' },
        location: { type: 'string' },
        contactInfo: { type: 'string', nullable: true },
        isActive: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  @ApiResponse({
    status: 400,
    description: 'Validation error or duplicate warehouse name',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description:
      'Insufficient permissions (requires SUPER_ADMIN or OPERATIONS_CLERK role)',
  })
  async update(
    @Param('id') id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
    @Request() req: any,
  ) {
    return this.warehousesService.update(id, updateWarehouseDto, req.user.id);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({
    summary: 'Activate or deactivate warehouse',
    description:
      'Toggles warehouse active status. Cannot deactivate the last active warehouse.',
  })
  @ApiParam({
    name: 'id',
    description: 'Warehouse UUID',
    example: 'uuid-warehouse-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Warehouse status updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        warehouseId: { type: 'string' },
        name: { type: 'string' },
        location: { type: 'string' },
        isActive: { type: 'boolean' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot deactivate the last active warehouse',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description:
      'Insufficient permissions (requires SUPER_ADMIN or OPERATIONS_CLERK role)',
  })
  async toggleStatus(@Param('id') id: string, @Request() req: any) {
    return this.warehousesService.toggleStatus(id, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({
    summary: 'Remove warehouse (if no packages assigned)',
    description:
      'Deletes a warehouse if it has no package items assigned to it. Used when warehouse is no longer operational.',
  })
  @ApiParam({
    name: 'id',
    description: 'Warehouse UUID',
    example: 'uuid-warehouse-123',
  })
  @ApiResponse({
    status: 200,
    description: 'Warehouse removed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete warehouse with assigned packages',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description:
      'Insufficient permissions (requires SUPER_ADMIN or OPERATIONS_CLERK role)',
  })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.warehousesService.remove(id, req.user.id);
  }
}
