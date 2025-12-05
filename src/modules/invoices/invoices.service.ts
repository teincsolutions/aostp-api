import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import {
  Prisma,
  Invoice,
  InvoiceStatus,
  ShippingMode,
  AirShippingType,
} from '@prisma/client';
import { IdGeneratorService } from '../../shared/utils/id-generator.service';
import { PDFService } from '../../providers/pdf/pdf.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idGeneratorService: IdGeneratorService,
    private readonly pdfService: PDFService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async generateFromPackingList(
    packingListId: string,
    userId: string,
  ): Promise<Invoice[]> {
    // Get packing list with packages
    const packingList = await this.prisma.packingList.findUnique({
      where: { id: packingListId },
      include: {
        packages: {
          select: {
            id: true,
            trackingCode: true,
            description: true,
            weight: true,
            cbm: true,
            customerId: true,
            shippingMode: true,
            airShippingType: true,
            quantity: true,
            shippingCost: true,
            shippingCurrency: true,
            customer: {
              select: {
                customerCode: true,
                firstName: true,
                lastName: true,
              },
            },
            items: true,
            warehouse: true,
          },
        },
        container: true,
      },
    });

    if (!packingList) {
      throw new NotFoundException(
        `Packing list with ID ${packingListId} not found`,
      );
    }

    if (packingList.packages.length === 0) {
      throw new BadRequestException(
        'Cannot generate invoices for empty packing list',
      );
    }

    const invoices: Invoice[] = [];

    // Generate one invoice per package (not per customer)
    for (const pkg of packingList.packages) {
      // Check if invoice already exists for this package
      const existingInvoice = await this.prisma.invoice.findFirst({
        where: {
          packageId: pkg.id,
        },
      });

      if (existingInvoice) {
        this.logger.warn(
          `Invoice already exists for package ${pkg.trackingCode}`,
        );
        continue;
      }

      // Use package's pre-calculated shipping cost directly
      const totalAmount = pkg.shippingCost || 0;

      if (!totalAmount) {
        this.logger.warn(
          `Package ${pkg.trackingCode} has no shipping cost set`,
        );
      }

      // Generate invoice number
      const invoiceNumber =
        await this.idGeneratorService.generateInvoiceNumber();

      // Use container's ETA as due date, fallback to 30 days from now
      const dueDate = packingList.container?.eta
        ? new Date(packingList.container.eta)
        : (() => {
            const fallbackDate = new Date();
            fallbackDate.setDate(fallbackDate.getDate() + 30);
            return fallbackDate;
          })();

      const result = await this.prisma.$transaction(async (tx) => {
        // Create invoice - one invoice per package
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            customerId: pkg.customerId,
            packingListId,
            packageId: pkg.id,
            totalAmount, // Always set totalAmount in the shipping currency
            currency: 'USD', // Use package's shipping currency
            localAmount: 0, // FX deferred to payment time
            status: InvoiceStatus.UNPAID,
            dueDate,
            balance: totalAmount, // Initial balance equals total amount
            notes: `Invoice for package ${pkg.trackingCode}`,
          },
          include: {
            customer: true,
            packingList: {
              include: {
                container: true,
              },
            },
            package: {
              include: {
                items: true, // Include package items for invoice PDF
              },
            },
          },
        });

        // Update package to link to this invoice
        await tx.package.update({
          where: { id: pkg.id },
          data: {
            invoice: {
              connect: { id: invoice.id },
            },
          },
        });

        // Log the action
        await tx.auditLog.create({
          data: {
            userId,
            action: 'CREATE',
            entity: 'Invoice',
            entityId: invoice.id,
            after: invoice as any,
            metadata: {
              packingListId,
              packageId: pkg.id,
              packageTrackingCode: pkg.trackingCode,
              customerCode: pkg.customer.customerCode,
              generatedFromPackingList: true,
            },
          },
        });

        return invoice;
      });

      invoices.push(result);

      this.logger.log(
        `Invoice ${invoiceNumber} generated for package ${pkg.trackingCode} - Amount: ${totalAmount} ${pkg.shippingCurrency || 'USD'}`,
      );
    }

    return invoices;
  }

  /**
   * Generate invoice for a single package (not through packing list)
   */
  async generateFromPackage(
    packageId: string,
    userId: string,
  ): Promise<Invoice> {
    // Get package with related data
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        trackingCode: true,
        description: true,
        weight: true,
        cbm: true,
        customerId: true,
        shippingMode: true,
        airShippingType: true,
        quantity: true,
        shippingCost: true,
        shippingCurrency: true,
        customer: {
          select: {
            customerCode: true,
            firstName: true,
            lastName: true,
          },
        },
        warehouse: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }

    // Check if invoice already exists for this package
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        packageId: pkg.id,
      },
    });

    if (existingInvoice) {
      throw new BadRequestException(
        `Invoice already exists for package ${pkg.trackingCode}`,
      );
    }

    // Use package's pre-calculated shipping cost directly
    const totalAmount = pkg.shippingCost || 0;

    if (!totalAmount) {
      throw new BadRequestException(
        `Package ${pkg.trackingCode} has no shipping cost set`,
      );
    }

    // Generate invoice number
    const invoiceNumber = await this.idGeneratorService.generateInvoiceNumber();

    // Calculate due date (30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const result = await this.prisma.$transaction(async (tx) => {
      // Create invoice for the package
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: pkg.customerId,
          packageId: pkg.id,
          totalAmount,
          currency: pkg.shippingCurrency || 'USD', // Use package's shipping currency
          localAmount: 0, // FX deferred to payment time
          status: InvoiceStatus.UNPAID,
          dueDate,
          balance: totalAmount, // Initial balance equals total amount
          notes: `Invoice for package ${pkg.trackingCode}`,
        },
        include: {
          customer: true,
          package: {
            include: {
              items: true,
              warehouse: true,
            },
          },
        },
      });

      // Update package to link to this invoice
      await tx.package.update({
        where: { id: pkg.id },
        data: {
          invoice: {
            connect: { id: invoice.id },
          },
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entity: 'Invoice',
          entityId: invoice.id,
          after: invoice as any,
          metadata: {
            packageId: pkg.id,
            packageTrackingCode: pkg.trackingCode,
            customerCode: pkg.customer.customerCode,
            generatedFromPackage: true,
          },
        },
      });

      return invoice;
    });

    // Return the complete invoice with relations
    const completeInvoice = await this.findOne(result.id);

    this.logger.log(
      `Invoice ${invoiceNumber} generated for package ${result.package?.trackingCode} - Amount: ${totalAmount} ${pkg.shippingCurrency || 'USD'}`,
    );

    return completeInvoice;
  }

  private async getShippingRate(
    shippingMode: ShippingMode,
    airShippingType: AirShippingType | null,
    cityId?: string,
  ): Promise<number> {
    const rate = await this.prisma.shippingRate.findFirst({
      where: {
        shippingMode,
        airShippingType: airShippingType || null,
        cityId: cityId,
        isActive: true,
        effectiveFrom: {
          lte: new Date(),
        },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!rate) {
      throw new BadRequestException(
        `No active shipping rate found for ${shippingMode}${
          airShippingType ? ` - ${airShippingType}` : ''
        }`,
      );
    }

    return rate.ratePerUnit;
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      customerId?: string;
      status?: InvoiceStatus;
      packingListId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
  ) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {};

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.packingListId) {
      where.packingListId = filters.packingListId;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo);
      }
    }

    // Search across multiple fields (invoice number, package tracking code, pickup code, packing list name, container number)
    if (filters?.search) {
      where.OR = [
        {
          invoiceNumber: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          package: {
            trackingCode: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
        },
        {
          package: {
            pickupCode: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
        },
        {
          packingList: {
            name: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
        },
        {
          packingList: {
            container: {
              containerNumber: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: true,
          packingList: {
            include: {
              container: true,
            },
          },
          package: {
            select: {
              id: true,
              trackingCode: true,
              description: true,
              weight: true,
              cbm: true,
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              currency: true,
              processedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        packingList: {
          include: {
            container: {
              include: {
                departureCity: true,
                destinationCity: true,
              },
            },
          },
        },
        package: {
          include: {
            items: true,
            warehouse: true,
          },
        },
        payments: {
          include: {
            processedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  async update(
    id: string,
    updateInvoiceDto: UpdateInvoiceDto,
    userId: string,
  ): Promise<Invoice> {
    const existingInvoice = await this.findOne(id);

    const updateData: any = { ...updateInvoiceDto };

    if (updateInvoiceDto.dueDate) {
      updateData.dueDate = new Date(updateInvoiceDto.dueDate);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          packingList: {
            include: {
              container: true,
            },
          },
          package: {
            include: {
              items: true,
            },
          },
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'Invoice',
          entityId: id,
          before: existingInvoice as any,
          after: updatedInvoice as any,
        },
      });

      return updatedInvoice;
    });

    this.logger.log(`Invoice ${result.invoiceNumber} updated`);
    return result;
  }

  async getCustomerInvoices(customerId: string, paginationDto: PaginationDto) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { customerId },
        skip,
        take: limit,
        include: {
          packingList: {
            include: {
              container: true,
            },
          },
          package: {
            select: {
              id: true,
              trackingCode: true,
              description: true,
              weight: true,
              cbm: true,
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              currency: true,
              processedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where: { customerId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPendingInvoices(customerId?: string) {
    const where: Prisma.InvoiceWhereInput = {
      status: InvoiceStatus.UNPAID,
      OR: [
        { paidAmount: 0 },
        {
          paidAmount: {
            lt: this.prisma.invoice.fields.totalAmount,
          },
        },
      ],
    };

    if (customerId) {
      where.customerId = customerId;
    }

    return this.prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        packingList: {
          include: {
            container: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getPendingDeliveryInvoices(
    customerId?: string,
    paginationDto?: PaginationDto,
  ) {
    const { page = 1, limit = 20 } = paginationDto || {};
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      package: {
        delivery: null, // Package has no delivery record
      },
    };

    if (customerId) {
      where.customerId = customerId;
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          package: {
            include: {
              warehouse: true,
              delivery: true,
            },
          },
          packingList: {
            include: {
              container: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsPaid(id: string, userId: string): Promise<Invoice> {
    const invoice = await this.findOne(id);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already marked as paid');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.PAID,
          paidAmount: invoice.totalAmount,
        },
        include: {
          customer: true,
          package: {
            include: {
              items: true,
            },
          },
        },
      });

      // Update package payment status
      await tx.package.updateMany({
        where: {
          id: invoice.packageId || '',
        },
        data: { paymentStatus: 'PAID' },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'Invoice',
          entityId: id,
          before: invoice as any,
          after: updatedInvoice as any,
          metadata: {
            action: 'MARKED_AS_PAID',
          },
        },
      });

      return updatedInvoice;
    });

    this.logger.log(`Invoice ${result.invoiceNumber} marked as paid`);
    return result;
  }

  async remove(id: string, userId: string): Promise<Invoice> {
    const existingInvoice = await this.findOne(id);

    // Check if invoice has payments
    const paymentCount = await this.prisma.payment.count({
      where: {
        invoices: {
          some: {
            id,
          },
        },
      },
    });

    if (paymentCount > 0) {
      throw new BadRequestException(
        'Cannot delete invoice that has associated payments',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Unlink packages from this invoice
      await tx.package.update({
        where: {
          id: existingInvoice.packageId || '',
        },
        data: {
          invoice: {
            disconnect: true,
          },
        },
      });

      const deletedInvoice = await tx.invoice.delete({
        where: { id },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELETE',
          entity: 'Invoice',
          entityId: id,
          before: existingInvoice as any,
        },
      });

      return deletedInvoice;
    });

    this.logger.log(`Invoice ${result.invoiceNumber} deleted`);
    return result;
  }

  async downloadInvoicePdf(id: string): Promise<string> {
    const invoice = await this.findOne(id);

    // If PDF key doesn't exist, generate PDF on-the-fly
    if (!invoice.invoicePdfKey) {
      try {
        this.logger.log(
          `Generating PDF on-demand for invoice ${invoice.invoiceNumber}`,
        );

        const result = await this.generateInvoicePdfData(invoice);
        return result.url;
      } catch (error) {
        this.logger.error(
          `Failed to generate PDF on-demand for invoice ${invoice.invoiceNumber}`,
          error,
        );
        throw new NotFoundException(
          `Couldn't generate PDF for invoice ${invoice.invoiceNumber}`,
        );
      }
    }

    return this.pdfService.generateSignedDownloadUrl(invoice.invoicePdfKey);
  }

  /**
   * Force regeneration of invoice PDF
   */
  async regenerateInvoicePdf(
    id: string,
    userId: string,
  ): Promise<{ url: string; key: string }> {
    const invoice = await this.findOne(id);

    try {
      this.logger.log(`Regenerating PDF for invoice ${invoice.invoiceNumber}`);

      const result = await this.generateInvoicePdfData(invoice);

      // Log the action
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'Invoice',
          entityId: id,
          after: { invoicePdfKey: result.key },
          metadata: {
            action: 'REGENERATE_PDF',
            invoiceNumber: invoice.invoiceNumber,
          },
        },
      });

      this.logger.log(
        `PDF regenerated for invoice ${invoice.invoiceNumber} - Key: ${result.key}`,
      );

      // Send notification about PDF regeneration if customer has contact info
      try {
        await this.sendPdfRegenerationNotification(invoice, result.url);
      } catch (notificationError) {
        this.logger.error(
          `Failed to send regeneration notification for invoice ${invoice.invoiceNumber}`,
          notificationError,
        );
        // Don't fail the entire operation if notification fails
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to regenerate PDF for invoice ${invoice.invoiceNumber}`,
        error,
      );
      throw new NotFoundException(
        `Couldn't regenerate PDF for invoice ${invoice.invoiceNumber}`,
      );
    }
  }

  /**
   * Common method to generate PDF data for an invoice
   */
  private async generateInvoicePdfData(
    invoice: any,
  ): Promise<{ url: string; key: string }> {
    // Get company info from PDF service (which uses config)
    const companyInfo = {
      name: 'AOSTP Logistics',
      address: 'Accra, Ghana',
      phone: '+233 XX XXX XXXX',
      email: 'info@aostp.com',
    };

    // Prepare invoice data for PDF generation similar to packing-lists service
    const pdfData = {
      company: companyInfo,
      invoice: {
        number: invoice.invoiceNumber,
        date: invoice.createdAt.toISOString().split('T')[0],
        dueDate: invoice.dueDate.toISOString().split('T')[0],
        status: invoice.status,
      },
      customer: {
        code: invoice.customer.customerCode,
        name: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
        address: invoice.customer.address || '',
        phone: invoice.customer.phoneNumber || '',
        email: invoice.customer.email || '',
      },
      container: invoice.packingList?.container
        ? {
            number: invoice.packingList.container.containerNumber,
            loadingDate: invoice.packingList.loadingDate
              .toISOString()
              .split('T')[0],
            origin:
              invoice.packingList.container.departureCity?.name || 'Unknown',
            destination:
              invoice.packingList.container.destinationCity?.name || 'Unknown',
          }
        : undefined,
      package: invoice.package
        ? {
            trackingCode: invoice.package.trackingCode,
            description: invoice.package.description,
            shippingMode: invoice.package.shippingMode,
            airType: invoice.package.airShippingType,
            quantity: invoice.package.quantity,
            weightKg: invoice.package.weight,
            cbm: invoice.package.cbm,
            destinationCity: invoice.package.destinationCity,
            warehouse: invoice.package.warehouse?.name,
            pickupCode: invoice.package.pickupCode,
          }
        : undefined,
      // Use package items with correct unit pricing based on shipping rate
      items:
        invoice.package?.items?.map((item) => ({
          description: item.description || '',
          quantity: item.quantity,
          unitPrice: invoice.package?.shippingRate || 0,
          total: item.quantity * (invoice.package?.shippingRate || 0),
        })) || [],
      totals: {
        total: invoice.totalAmount,
        paid: invoice.paidAmount || 0,
        balance: invoice.balance,
        currency: invoice.currency,
      },
      currency: invoice.currency,
      notes: `Generated for Packing List: ${
        invoice.packingList?.name || 'N/A'
      }`,
    };

    // Generate PDF
    const pdfResult = await this.pdfService.generateInvoicePDF(pdfData);

    // Update invoice with PDF key in transaction
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { invoicePdfKey: pdfResult.key },
    });

    this.logger.log(
      `PDF generated for invoice ${invoice.invoiceNumber} - Key: ${pdfResult.key}`,
    );

    return pdfResult;
  }

  /**
   * Send notification about PDF regeneration
   */
  private async sendPdfRegenerationNotification(
    invoice: any,
    pdfUrl: string,
  ): Promise<void> {
    const channels: any[] = [];

    // Email content (HTML)
    if (invoice.customer.email) {
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invoice PDF Updated - AOSTP Logistics</h2>
          <p>Dear ${invoice.customer.firstName} ${invoice.customer.lastName},</p>
          <p>Your invoice PDF has been updated with the latest information.</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td><strong>Invoice Number:</strong></td><td>${invoice.invoiceNumber}</td></tr>
            <tr><td><strong>Total Amount:</strong></td><td>${invoice.currency} ${invoice.totalAmount}</td></tr>
            <tr><td><strong>Due Date:</strong></td><td>${new Date(invoice.dueDate).toLocaleDateString()}</td></tr>
          </table>
          <p>You can <a href="${pdfUrl}" target="_blank">download the latest invoice PDF</a> to view the updated details.</p>
          <p>If you have any questions, please contact our support team.</p>
          <p>Thank you for choosing AOSTP Logistics.</p>
        </div>
      `;
      channels.push({
        channel: 'EMAIL',
        recipient: invoice.customer.email,
        subject: 'Invoice PDF Updated - AOSTP Logistics',
        content: emailContent,
      });
    }

    // SMS/WhatsApp content (short, plain)
    if (invoice.customer.phoneNumber) {
      const channel =
        invoice.customer.preferredChannel === 'WHATSAPP'
          ? 'WHATSAPP'
          : invoice.customer.preferredChannel === 'SMS'
            ? 'SMS'
            : null;

      if (channel) {
        const content = `Hi ${invoice.customer.firstName}, your invoice ${invoice.invoiceNumber} PDF has been updated. Download: ${pdfUrl}`;
        channels.push({
          channel,
          recipient: invoice.customer.phoneNumber,
          content,
        });
      }
    }

    if (channels.length > 0) {
      await this.notificationsService.sendNotification({
        customer: invoice.customer,
        type: 'INVOICE_ISSUED', // Reuse existing type
        channels,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          action: 'PDF_REGENERATED',
          pdfUrl,
        },
      });
    }
  }
}
