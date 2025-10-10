import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PackingListsService } from './packing-lists.service';
import { CreatePackingListDto } from './dto/create-packing-list.dto';
import { UpdatePackingListDto } from './dto/update-packing-list.dto';
import { AddPackagesToPackingListDto } from './dto/add-packages.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Packing Lists')
@ApiBearerAuth()
@Controller('packing-lists')
export class PackingListsController {
  constructor(private readonly packingListsService: PackingListsService) {}

  @Post()
  @Roles(UserRole.OPERATIONS_CLERK, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new packing list' })
  @ApiResponse({
    status: 201,
    description: 'Packing list created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or duplicate name',
  })
  @ApiResponse({
    status: 404,
    description: 'Container not found',
  })
  async create(
    @Body() createPackingListDto: CreatePackingListDto,
    @Request() req: any,
  ) {
    return this.packingListsService.create(createPackingListDto, req.user.sub);
  }

  @Get()
  @Roles(
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({
    summary: 'Get all packing lists with pagination and filters',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'containerId', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of packing lists retrieved successfully',
  })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query('containerId') containerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
  ) {
    return this.packingListsService.findAll(paginationDto, {
      containerId,
      dateFrom,
      dateTo,
      search,
    });
  }

  @Get(':id')
  @Roles(
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Get packing list by ID' })
  @ApiParam({ name: 'id', description: 'Packing list UUID' })
  @ApiResponse({
    status: 200,
    description: 'Packing list retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Packing list not found',
  })
  async findOne(@Param('id') id: string) {
    return this.packingListsService.findOne(id);
  }

  @Get('by-name/:name')
  @Roles(
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Get packing list by name' })
  @ApiParam({ name: 'name', description: 'Packing list name' })
  @ApiResponse({
    status: 200,
    description: 'Packing list retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Packing list not found',
  })
  async findByName(@Param('name') name: string) {
    return this.packingListsService.findByName(name);
  }

  @Get(':id/summary')
  @Roles(
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({
    summary: 'Get packing list summary grouped by customer',
  })
  @ApiParam({ name: 'id', description: 'Packing list UUID' })
  @ApiResponse({
    status: 200,
    description: 'Packing list summary retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Packing list not found',
  })
  async getPackingListSummary(@Param('id') id: string) {
    return this.packingListsService.getPackingListSummary(id);
  }

  @Get(':id/export')
  @Roles(
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({
    summary: 'Get packing list data formatted for export (PDF/Excel)',
  })
  @ApiParam({ name: 'id', description: 'Packing list UUID' })
  @ApiResponse({
    status: 200,
    description: 'Export data retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Packing list not found',
  })
  async getExportData(@Param('id') id: string) {
    return this.packingListsService.getExportData(id);
  }

  @Patch(':id')
  @Roles(UserRole.OPERATIONS_CLERK, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update packing list' })
  @ApiParam({ name: 'id', description: 'Packing list UUID' })
  @ApiResponse({
    status: 200,
    description: 'Packing list updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Packing list not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or duplicate name',
  })
  async update(
    @Param('id') id: string,
    @Body() updatePackingListDto: UpdatePackingListDto,
    @Request() req: any,
  ) {
    return this.packingListsService.update(
      id,
      updatePackingListDto,
      req.user.sub,
    );
  }

  @Post(':id/packages')
  @Roles(UserRole.OPERATIONS_CLERK, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add packages to packing list' })
  @ApiParam({ name: 'id', description: 'Packing list UUID' })
  @ApiResponse({
    status: 200,
    description: 'Packages added to packing list successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Packing list not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid packages or already assigned',
  })
  async addPackages(
    @Param('id') id: string,
    @Body() addPackagesDto: AddPackagesToPackingListDto,
    @Request() req: any,
  ) {
    return this.packingListsService.addPackages(
      id,
      addPackagesDto,
      req.user.sub,
    );
  }

  @Delete(':id/packages')
  @Roles(UserRole.OPERATIONS_CLERK, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove packages from packing list' })
  @ApiParam({ name: 'id', description: 'Packing list UUID' })
  @ApiQuery({
    name: 'packageIds',
    required: true,
    type: String,
    description: 'Comma-separated package IDs to remove',
    example: 'uuid1,uuid2,uuid3',
  })
  @ApiResponse({
    status: 200,
    description: 'Packages removed from packing list successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Packing list not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - packages do not belong to packing list',
  })
  async removePackages(
    @Param('id') id: string,
    @Query('packageIds') packageIds: string,
    @Request() req: any,
  ) {
    const packageIdArray = packageIds.split(',').map((id) => id.trim());
    return this.packingListsService.removePackages(
      id,
      packageIdArray,
      req.user.sub,
    );
  }

  @Post(':id/finalize')
  @Roles(UserRole.OPERATIONS_CLERK, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finalize packing list and generate invoices' })
  @ApiParam({ name: 'id', description: 'Packing list UUID' })
  @ApiResponse({
    status: 200,
    description: 'Packing list finalized and invoices generated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Packing list not found',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - validation failed (no packages, not consolidated, etc.)',
  })
  async finalize(@Param('id') id: string, @Request() req: any) {
    return this.packingListsService.finalize(id, req.user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.OPERATIONS_CLERK, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete packing list' })
  @ApiParam({ name: 'id', description: 'Packing list UUID' })
  @ApiResponse({
    status: 200,
    description: 'Packing list deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Packing list not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - packing list has associated invoices',
  })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.packingListsService.remove(id, req.user.sub);
  }
}
