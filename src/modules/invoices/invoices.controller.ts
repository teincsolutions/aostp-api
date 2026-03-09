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
import { InvoiceFilterDto } from './dto/invoice-filter.dto';
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
  @Roles(UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
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
    UserRole.FINANCE_MANAGER,
    UserRole.PAYMENT_CLERK,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Get all invoices with filters and pagination' })
  findAll(@Query() filterDto: InvoiceFilterDto) {
    const { page, limit, sortBy, sortOrder, ...filters } = filterDto;

    const paginationDto = { page, limit, sortBy, sortOrder };

    return this.invoicesService.findAll(paginationDto, filters);
  }

  @Get('pending')
  @Roles(UserRole.FINANCE_MANAGER, UserRole.PAYMENT_CLERK, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get pending invoices' })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  findPending(@Query('customerId') customerId?: string) {
    return this.invoicesService.getPendingInvoices(customerId);
  }

  @Get('pending-delivery')
  @Roles(
    UserRole.FINANCE_MANAGER,
    UserRole.PAYMENT_CLERK,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({
    summary: 'Get invoices pending delivery',
    description:
      'Retrieves invoices whose packages have not been delivered yet',
  })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Invoices pending delivery retrieved successfully',
  })
  findPendingDelivery(
    @Query('customerId') customerId?: string,
    @Query() paginationDto?: PaginationDto,
  ) {
    return this.invoicesService.getPendingDeliveryInvoices(
      customerId,
      paginationDto,
    );
  }

  @Get('customer/:customerId')
  @Roles(
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

  @Get(':id/download-pdf')
  @Roles(
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

  @Post(':id/regenerate-pdf')
  @Roles(
    UserRole.FINANCE_MANAGER,
    UserRole.SUPER_ADMIN,
    UserRole.PAYMENT_CLERK,
  )
  @ApiOperation({ summary: 'Regenerate invoice PDF' })
  @ApiResponse({ status: 200, description: 'PDF regenerated successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @HttpCode(HttpStatus.OK)
  async regenerateInvoicePdf(@Param('id') id: string, @Request() req: any) {
    const result = await this.invoicesService.regenerateInvoicePdf(
      id,
      req.user.sub,
    );
    return { message: 'Invoice PDF regenerated successfully', ...result };
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
