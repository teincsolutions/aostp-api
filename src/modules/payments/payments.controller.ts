import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(UserRole.PAYMENT_CLERK, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Process a new payment' })
  @ApiResponse({ status: 201, description: 'Payment processed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation errors' })
  @ApiResponse({ status: 404, description: 'Customer or invoice not found' })
  create(@Body() createPaymentDto: CreatePaymentDto, @Request() req: any) {
    return this.paymentsService.create(createPaymentDto, req.user.sub);
  }

  @Get()
  @Roles(UserRole.PAYMENT_CLERK, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all payments with filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'paymentMethod', required: false, type: String })
  @ApiQuery({ name: 'currency', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('customerId') customerId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('currency') currency?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const filters = {
      customerId,
      paymentMethod,
      currency,
      dateFrom,
      dateTo,
    };

    return this.paymentsService.findAll(paginationDto, filters);
  }

  @Get('stats')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get payment statistics' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  getStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.paymentsService.getPaymentStats({
      dateFrom,
      dateTo,
      customerId,
    });
  }

  @Get('customer/:customerId')
  @Roles(
    UserRole.PAYMENT_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Get payments for a specific customer' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findCustomerPayments(
    @Param('customerId') customerId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.paymentsService.getCustomerPayments(customerId, paginationDto);
  }

  @Get('code/:paymentCode')
  @Roles(
    UserRole.PAYMENT_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Get a payment by payment code' })
  @ApiResponse({ status: 200, description: 'Payment found' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  findByCode(@Param('paymentCode') paymentCode: string) {
    return this.paymentsService.findByCode(paymentCode);
  }

  @Get(':id')
  @Roles(UserRole.PAYMENT_CLERK, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a specific payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment found' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.PAYMENT_CLERK, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a payment' })
  @ApiResponse({ status: 200, description: 'Payment updated successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  update(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @Request() req: any,
  ) {
    return this.paymentsService.update(id, updatePaymentDto, req.user.sub);
  }

  @Post(':id/refund')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Request a refund for a payment' })
  @ApiResponse({ status: 200, description: 'Refund request processed' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid refund amount or other validation error',
  })
  requestRefund(
    @Param('id') id: string,
    @Body('refundAmount') refundAmount: number,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.paymentsService.processRefund(
      id,
      refundAmount,
      reason,
      req.user.sub,
    );
  }
}
