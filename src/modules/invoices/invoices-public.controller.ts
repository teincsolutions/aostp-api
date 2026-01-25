import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';

@ApiTags('public/invoices')
@Controller('public/invoices')
export class InvoicesPublicController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':accessToken')
  @ApiOperation({
    summary: 'Get invoice by access token (public)',
    description:
      'Public endpoint to retrieve invoice details using access token. No authentication required.',
  })
  @ApiParam({
    name: 'accessToken',
    description: 'Unique access token for the invoice',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice found',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        invoiceNumber: { type: 'string' },
        totalAmount: { type: 'number' },
        currency: { type: 'string' },
        localAmount: { type: 'number' },
        status: { type: 'string' },
        dueDate: { type: 'string', format: 'date-time' },
        paidAmount: { type: 'number' },
        balance: { type: 'number' },
        customer: {
          type: 'object',
          properties: {
            customerCode: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
        package: {
          type: 'object',
          properties: {
            trackingCode: { type: 'string' },
            description: { type: 'string' },
            weight: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findByAccessToken(@Param('accessToken') accessToken: string) {
    return this.invoicesService.findByAccessToken(accessToken);
  }

  @Get(':accessToken/pdf')
  @ApiOperation({
    summary: 'Get invoice PDF download URL (public)',
    description:
      'Public endpoint to get a signed URL for downloading invoice PDF.',
  })
  @ApiParam({
    name: 'accessToken',
    description: 'Unique access token for the invoice',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Signed download URL returned',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Invoice or PDF not found' })
  async downloadPdfByAccessToken(@Param('accessToken') accessToken: string) {
    const url =
      await this.invoicesService.downloadInvoicePdfByAccessToken(accessToken);
    return { url };
  }
}
