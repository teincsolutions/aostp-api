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
  UnauthorizedException,
  NotFoundException,
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
import { FilterPaymentDto } from './dto/filter-payment.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { UserRole } from '@prisma/client';
import { Logger } from '@nestjs/common';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(UserRole.PAYMENT_CLERK, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Process a new payment' })
  @ApiResponse({ status: 201, description: 'Payment processed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation errors' })
  @ApiResponse({ status: 404, description: 'Customer or invoice not found' })
  create(@Body() createPaymentDto: CreatePaymentDto, @Request() req: any) {
    return this.paymentsService.create(createPaymentDto, req.user.id);
  }

  @Post('hubtel/callback/:token')
  @Public()
  @ApiOperation({
    summary: 'Generic payment callback with signed token verification',
  })
  @ApiResponse({ status: 200, description: 'Callback processed' })
  @ApiResponse({ status: 400, description: 'Invalid callback data' })
  @ApiResponse({ status: 401, description: 'Invalid callback token' })
  async paymentCallback(
    @Param('token') token: string,
    @Body() callbackData: any,
  ): Promise<{ status: 'success' | 'failed' }> {
    try {
      // Verify the signed token to ensure callback authenticity
      const tokenData = await this.paymentsService.verifyCallbackToken(token);

      this.logger.log(
        `Verified callback token for payment ${tokenData.paymentCode}`,
      );

      // Process the callback with the verified payment method
      return await this.paymentsService.processPaymentCallback(
        tokenData.paymentMethod,
        callbackData,
      );
    } catch (error) {
      this.logger.error(`Callback token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid callback token');
    }
  }

  @Get()
  @Roles(UserRole.PAYMENT_CLERK, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all payments with filters and pagination' })
  findAll(@Query() filterDto: FilterPaymentDto) {
    const { page, limit, sortBy, sortOrder, ...filters } = filterDto;

    const paginationDto: PaginationDto = { page, limit, sortBy, sortOrder };

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
    return this.paymentsService.update(id, updatePaymentDto, req.user.id);
  }

  @Get(':id/receipt')
  @Roles(
    UserRole.PAYMENT_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Get payment receipt URL' })
  @ApiResponse({ status: 200, description: 'Receipt URL retrieved' })
  @ApiResponse({ status: 404, description: 'Payment or receipt not found' })
  async getPaymentReceipt(@Param('id') id: string) {
    const payment = await this.paymentsService.findOne(id);

    if (!payment.receiptKey) {
      // If no receipt exists, try to generate one
      try {
        const receiptResult =
          await this.paymentsService.generatePaymentReceipt(id);
        return { url: receiptResult.url, key: receiptResult.key };
      } catch (error) {
        throw new NotFoundException(
          'Receipt not found and could not be generated',
        );
      }
    }

    // Get the signed URL for the receipt
    const url = await this.paymentsService.getPaymentReceiptUrl(
      payment.receiptKey,
    );
    return { url, key: payment.receiptKey };
  }

  @Get(':id/document')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get payment reference document URL (CR-01)',
    description:
      'Generates a presigned URL to download the payment reference document. Only accessible by Finance Manager and Super Admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Document URL retrieved',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Presigned download URL' },
        key: { type: 'string', description: 'S3 object key' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Payment or document not found' })
  async getPaymentDocument(@Param('id') id: string) {
    const payment = await this.paymentsService.findOne(id);

    if (!payment.referenceDocumentKey) {
      throw new NotFoundException(
        'No reference document found for this payment',
      );
    }

    // Get the signed URL for the document
    const url = await this.paymentsService.getPaymentDocumentUrl(
      payment.referenceDocumentKey,
    );
    return { url, key: payment.referenceDocumentKey };
  }

  @Patch(':id/delete')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete a payment (Super Admin only)',
    description:
      'Permanently deletes a payment record from the database. This action is restricted to Super Admin only and cannot be undone. An audit log entry will be created before deletion.',
  })
  @ApiResponse({ status: 200, description: 'Payment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super Admin access required',
  })
  async deletePayment(@Param('id') id: string, @Request() req: any) {
    return await this.paymentsService.deletePayment(id, req.user.id);
  }
}
