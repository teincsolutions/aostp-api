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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, InvoiceStatus } from '@prisma/client';

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('generate/:packingListId')
  @Roles(UserRole.OPERATIONS_CLERK, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate invoices from packing list' })
  @ApiResponse({ status: 201, description: 'Invoices generated successfully' })
  @ApiResponse({ status: 404, description: 'Packing list not found' })
  @HttpCode(HttpStatus.CREATED)
  async generateFromPackingList(
    @Param('packingListId') packingListId: string,
    @Request() req: any,
  ) {
    const invoices = await this.invoicesService.generateFromPackingList(
      packingListId,
      req.user.sub,
    );
    return {
      message: `Generated ${invoices.length} invoice(s)`,
      data: invoices,
    };
  }

  @Get()
  @Roles(
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.PAYMENT_CLERK,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Get all invoices with filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'packingListId', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('customerId') customerId?: string,
    @Query('status') status?: InvoiceStatus,
    @Query('packingListId') packingListId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const filters = {
      customerId,
      status,
      packingListId,
      dateFrom,
      dateTo,
    };

    return this.invoicesService.findAll(paginationDto, filters);
  }

  @Get('pending')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.PAYMENT_CLERK, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get pending invoices' })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  findPending(@Query('customerId') customerId?: string) {
    return this.invoicesService.getPendingInvoices(customerId);
  }

  @Get('customer/:customerId')
  @Roles(
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.PAYMENT_CLERK,
    UserRole.SUPER_ADMIN,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Get invoices for a specific customer' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findCustomerInvoices(
    @Param('customerId') customerId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.invoicesService.getCustomerInvoices(customerId, paginationDto);
  }

  @Get(':id')
  @Roles(
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.PAYMENT_CLERK,
    UserRole.SUPER_ADMIN,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Get a specific invoice by ID' })
  @ApiResponse({ status: 200, description: 'Invoice found' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id')
  @Roles(
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Update an invoice' })
  @ApiResponse({ status: 200, description: 'Invoice updated successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  update(
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
    @Request() req: any,
  ) {
    return this.invoicesService.update(id, updateInvoiceDto, req.user.sub);
  }

  @Patch(':id/mark-paid')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.PAYMENT_CLERK, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark an invoice as paid' })
  @ApiResponse({ status: 200, description: 'Invoice marked as paid' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 400, description: 'Invoice already paid' })
  markAsPaid(@Param('id') id: string, @Request() req: any) {
    return this.invoicesService.markAsPaid(id, req.user.sub);
  }

  @Get(':id/download-pdf')
  @Roles(
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
    UserRole.PAYMENT_CLERK,
    UserRole.SUPER_ADMIN,
    UserRole.CUSTOMER,
  )
  @ApiOperation({ summary: 'Download invoice PDF' })
  @ApiResponse({ status: 200, description: 'Signed download URL returned' })
  @ApiResponse({ status: 404, description: 'Invoice PDF not found' })
  async downloadInvoicePdf(@Param('id') id: string) {
    const url = await this.invoicesService.downloadInvoicePdf(id);
    return { url };
  }

  @Delete(':id')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete an invoice' })
  @ApiResponse({ status: 200, description: 'Invoice deleted successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete invoice with payments',
  })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.invoicesService.remove(id, req.user.sub);
  }
}
