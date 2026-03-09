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
  ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ShippingRatesService } from './shipping-rates.service';
import { CreateShippingRateDto } from './dto/create-shipping-rate.dto';
import { UpdateShippingRateDto } from './dto/update-shipping-rate.dto';
import { CalculateShippingCostDto } from './dto/calculate-shipping-cost.dto';
import { FindShippingRatesDto } from './dto/find-shipping-rates.dto';
import {
  ShippingRatePathParamsDto,
  ShippingRateQueryParamsDto,
} from './dto/shipping-rate-path-params.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, ShippingMode, AirShippingType } from '@prisma/client';

@ApiTags('shipping-rates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shipping-rates')
export class ShippingRatesController {
  constructor(private readonly shippingRatesService: ShippingRatesService) {}

  @Post()
  @Roles(UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new shipping rate' })
  @ApiResponse({
    status: 201,
    description: 'Shipping rate created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation errors' })
  create(
    @Body() createShippingRateDto: CreateShippingRateDto,
    @Request() req: any,
  ) {
    return this.shippingRatesService.create(
      createShippingRateDto,
      req.user.sub,
    );
  }

  @Get()
  @Roles(
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({
    summary: 'Get all shipping rates with filters and pagination',
  })
  findAll(@Query() query: FindShippingRatesDto) {
    return this.shippingRatesService.findAll(query);
  }

  @Get('active')
  @Roles(
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Get all active shipping rates' })
  findActive() {
    return this.shippingRatesService.getActiveRates();
  }

  @Get('current/:shippingMode')
  @Roles(
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Get current rate for shipping mode' })
  findCurrentRate(
    @Param('shippingMode', new ParseEnumPipe(ShippingMode))
    shippingMode: ShippingMode,
    @Query() queryParams?: ShippingRateQueryParamsDto,
  ) {
    return this.shippingRatesService.getCurrentRate(
      shippingMode,
      queryParams?.airShippingType,
    );
  }

  @Get('history')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get historical rates for shipping mode' })
  findHistoricalRates(@Query() queryParams: FindShippingRatesDto) {
    return this.shippingRatesService.findAll(queryParams);
  }

  @Get(':id')
  @Roles(
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Get a specific shipping rate by ID' })
  @ApiResponse({ status: 200, description: 'Shipping rate found' })
  @ApiResponse({ status: 404, description: 'Shipping rate not found' })
  findOne(@Param('id') id: string) {
    return this.shippingRatesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a shipping rate' })
  @ApiResponse({
    status: 200,
    description: 'Shipping rate updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Shipping rate not found' })
  update(
    @Param('id') id: string,
    @Body() updateShippingRateDto: UpdateShippingRateDto,
    @Request() req: any,
  ) {
    return this.shippingRatesService.update(
      id,
      updateShippingRateDto,
      req.user.sub,
    );
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a shipping rate' })
  @ApiResponse({
    status: 200,
    description: 'Shipping rate deactivated successfully',
  })
  @ApiResponse({ status: 404, description: 'Shipping rate not found' })
  @ApiResponse({ status: 400, description: 'Shipping rate already inactive' })
  deactivate(@Param('id') id: string, @Request() req: any) {
    return this.shippingRatesService.deactivate(id, req.user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a shipping rate' })
  @ApiResponse({
    status: 200,
    description: 'Shipping rate deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Shipping rate not found' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.shippingRatesService.remove(id, req.user.sub);
  }
}
