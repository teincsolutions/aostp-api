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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { PackageFilterDto } from './dto/package-filter.dto';
import { WarehousePackagesDto } from './dto/warehouse-packages.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { UserRole, PackageStatus } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('packages')
@ApiBearerAuth()
@Controller('packages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({ summary: 'Create a new package' })
  @ApiResponse({ status: 201, description: 'Package created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  create(@Body() createPackageDto: CreatePackageDto, @Request() req) {
    return this.packagesService.create(createPackageDto, req.user.id);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.PAYMENT_CLERK,
  )
  @ApiOperation({ summary: 'Get all packages with pagination and filters' })
  findAll(@Query() filterDto: PackageFilterDto) {
    const {
      customerId,
      status,
      shippingMode,
      packingListId,
      paymentStatus,
      search,
      ...paginationDto
    } = filterDto;
    return this.packagesService.findAll(paginationDto, {
      customerId,
      status,
      shippingMode,
      packingListId,
      paymentStatus,
      search,
    });
  }

  @Get('warehouse')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({
    summary: 'Get packages in warehouse with pagination and filters',
  })
  getWarehousePackages(@Query() warehouseFilter: WarehousePackagesDto) {
    const {
      warehouseId,
      status,
      daysThreshold,
      dateFrom,
      dateTo,
      search,
      ...paginationDto
    } = warehouseFilter;
    return this.packagesService.getWarehousePackages(
      {
        warehouseId,
        status,
        daysThreshold,
        dateFrom,
        dateTo,
        search,
      },
      paginationDto,
    );
  }

  @Post('update-warehouse-days')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({ summary: 'Update warehouse days for all packages' })
  @HttpCode(HttpStatus.OK)
  updateWarehouseDays() {
    return this.packagesService.updateWarehouseDays();
  }

  @Get('tracking/:trackingCode')
  @Public()
  @ApiOperation({ summary: 'Get package by tracking code' })
  @ApiParam({ name: 'trackingCode', description: 'Package tracking code' })
  findByTrackingCode(@Param('trackingCode') trackingCode: string) {
    return this.packagesService.findByTrackingCode(trackingCode);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get package by ID' })
  @ApiParam({ name: 'id', description: 'Package ID' })
  findOne(@Param('id') id: string) {
    return this.packagesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({ summary: 'Update package' })
  @ApiParam({ name: 'id', description: 'Package ID' })
  update(
    @Param('id') id: string,
    @Body() updatePackageDto: UpdatePackageDto,
    @Request() req,
  ) {
    return this.packagesService.update(id, updatePackageDto, req.user.id);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({ summary: 'Update package status' })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiQuery({ name: 'status', enum: PackageStatus, required: true })
  updateStatus(
    @Param('id') id: string,
    @Query('status') status: PackageStatus,
    @Request() req,
  ) {
    return this.packagesService.updateStatus(id, status, req.user.id);
  }

  @Post(':id/photos')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({ summary: 'Add photo to package' })
  @ApiParam({ name: 'id', description: 'Package ID' })
  addPhoto(
    @Param('id') id: string,
    @Body() photo: { url: string; key: string },
    @Request() req,
  ) {
    return this.packagesService.addPhoto(id, photo, req.user.id);
  }

  @Delete(':id/photos/:photoId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({ summary: 'Remove photo from package' })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiParam({ name: 'photoId', description: 'Photo ID' })
  removePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Request() req,
  ) {
    return this.packagesService.removePhoto(id, photoId, req.user.id);
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Get package receipt signed URL' })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns signed URL for package receipt',
  })
  @ApiResponse({ status: 404, description: 'Package or receipt not found' })
  getReceiptUrl(@Param('id') id: string) {
    return this.packagesService.getReceiptUrl(id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete package' })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.packagesService.remove(id, req.user.id);
  }
}
