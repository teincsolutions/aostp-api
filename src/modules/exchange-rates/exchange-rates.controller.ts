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
import { ExchangeRatesService } from './exchange-rates.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { UpdateExchangeRateDto } from './dto/update-exchange-rate.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
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
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('exchange-rates')
@ApiBearerAuth()
@Controller('exchange-rates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Create a new exchange rate' })
  @ApiResponse({
    status: 201,
    description: 'Exchange rate created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createExchangeRateDto: CreateExchangeRateDto, @Request() req) {
    return this.exchangeRatesService.create(createExchangeRateDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER, UserRole.PAYMENT_CLERK)
  @ApiOperation({
    summary: 'Get all exchange rates with pagination and filters',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'fromCurrency', required: false, type: String })
  @ApiQuery({ name: 'toCurrency', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('fromCurrency') fromCurrency?: string,
    @Query('toCurrency') toCurrency?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.exchangeRatesService.findAll(paginationDto, {
      fromCurrency,
      toCurrency,
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get('active-pairs')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.PAYMENT_CLERK,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({ summary: 'Get all active currency pairs' })
  getActiveCurrencyPairs() {
    return this.exchangeRatesService.getActiveCurrencyPairs();
  }

  @Get('current/:fromCurrency/:toCurrency')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.PAYMENT_CLERK,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({ summary: 'Get current exchange rate for currency pair' })
  @ApiParam({ name: 'fromCurrency', description: 'From currency code' })
  @ApiParam({ name: 'toCurrency', description: 'To currency code' })
  getCurrentRate(
    @Param('fromCurrency') fromCurrency: string,
    @Param('toCurrency') toCurrency: string,
  ) {
    return this.exchangeRatesService.getCurrentRate(fromCurrency, toCurrency);
  }

  @Get('convert')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER, UserRole.PAYMENT_CLERK)
  @ApiOperation({ summary: 'Convert amount between currencies' })
  @ApiQuery({ name: 'amount', required: true, type: Number })
  @ApiQuery({ name: 'fromCurrency', required: true, type: String })
  @ApiQuery({ name: 'toCurrency', required: true, type: String })
  convertAmount(
    @Query('amount') amount: number,
    @Query('fromCurrency') fromCurrency: string,
    @Query('toCurrency') toCurrency: string,
  ) {
    return this.exchangeRatesService.convertAmount(
      amount,
      fromCurrency,
      toCurrency,
    );
  }

  @Get('historical/:fromCurrency/:toCurrency')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Get historical exchange rates for currency pair' })
  @ApiParam({ name: 'fromCurrency', description: 'From currency code' })
  @ApiParam({ name: 'toCurrency', description: 'To currency code' })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 50 })
  getHistoricalRates(
    @Param('fromCurrency') fromCurrency: string,
    @Param('toCurrency') toCurrency: string,
    @Query('limit') limit?: number,
  ) {
    return this.exchangeRatesService.getHistoricalRates(
      fromCurrency,
      toCurrency,
      limit,
    );
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER, UserRole.PAYMENT_CLERK)
  @ApiOperation({ summary: 'Get exchange rate by ID' })
  @ApiParam({ name: 'id', description: 'Exchange rate ID' })
  findOne(@Param('id') id: string) {
    return this.exchangeRatesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Update exchange rate' })
  @ApiParam({ name: 'id', description: 'Exchange rate ID' })
  update(
    @Param('id') id: string,
    @Body() updateExchangeRateDto: UpdateExchangeRateDto,
    @Request() req,
  ) {
    return this.exchangeRatesService.update(
      id,
      updateExchangeRateDto,
      req.user.id,
    );
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Deactivate exchange rate' })
  @ApiParam({ name: 'id', description: 'Exchange rate ID' })
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id') id: string, @Request() req) {
    return this.exchangeRatesService.deactivate(id, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete exchange rate' })
  @ApiParam({ name: 'id', description: 'Exchange rate ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.exchangeRatesService.remove(id, req.user.id);
  }
}
