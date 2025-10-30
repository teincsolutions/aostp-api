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

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idGeneratorService: IdGeneratorService,
    private readonly pdfService: PDFService,
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

      // Use package's pre-calculated shipping cost
      let totalAmount = pkg.shippingCost || 0;

      // If shipping cost is not calculated, fall back to dynamic calculation
      if (!totalAmount) {
        const rate = await this.getShippingRate(
          pkg.shippingMode,
          pkg.airShippingType,
          packingList.container.departureCityId,
        );
        if (pkg.shippingMode === ShippingMode.SEA) {
          totalAmount = (pkg.cbm || 0) * rate * (pkg.quantity || 1);
        } else {
          totalAmount = (pkg.weight || 0) * rate * (pkg.quantity || 1);
        }

        this.logger.warn(
          `Package ${pkg.trackingCode} has no shipping cost - using calculated amount: ${totalAmount}`,
        );
      }

      // Generate invoice number
      const invoiceNumber =
        await this.idGeneratorService.generateInvoiceNumber();

      // Calculate due date (30 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const result = await this.prisma.$transaction(async (tx) => {
        // Create invoice - one invoice per package
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            customerId: pkg.customerId,
            packingListId,
            packageId: pkg.id,
            totalAmount,
            currency: 'USD',
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
        `Invoice ${invoiceNumber} generated for package ${pkg.trackingCode} - Amount: ${totalAmount} USD`,
      );
    }

    return invoices;
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

  async create(
    createInvoiceDto: CreateInvoiceDto,
    userId: string,
  ): Promise<Invoice> {
    const {
      customerId,
      packingListId,
      dueDate,
      notes,
      currency = 'USD',
      exchangeRate: providedRate,
    } = createInvoiceDto;

    // Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    // Verify packing list exists
    const packingList = await this.prisma.packingList.findUnique({
      where: { id: packingListId },
      include: {
        packages: {
          where: { customerId },
        },
      },
    });

    if (!packingList) {
      throw new NotFoundException(
        `Packing list with ID ${packingListId} not found`,
      );
    }

    if (packingList.packages.length === 0) {
      throw new BadRequestException(
        'No packages found for this customer in the packing list',
      );
    }

    // Calculate total amount - NO currency conversion per Use Case rule
    let totalAmount = 0;
    for (const pkg of packingList.packages) {
      const rate = await this.getShippingRate(
        pkg.shippingMode,
        pkg.airShippingType,
      );
      if (pkg.shippingMode === ShippingMode.SEA) {
        totalAmount += (pkg.cbm || 0) * rate;
      } else {
        totalAmount += (pkg.weight || 0) * rate;
      }
    }

    const invoiceNumber = await this.idGeneratorService.generateInvoiceNumber();

    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId,
          packingListId,
          totalAmount,
          currency,
          localAmount: 0, // FX conversion deferred to payment time per use case rule
          status: InvoiceStatus.UNPAID,
          dueDate: dueDate
            ? new Date(dueDate)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          balance: totalAmount, // Initial balance equals total amount
          notes,
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
              items: true,
            },
          },
        },
      });

      // Update package to link to this invoice (old create method, need to update)
      // Note: This method might not be needed anymore since we changed to 1 invoice per package

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entity: 'Invoice',
          entityId: invoice.id,
          after: invoice as any,
        },
      });

      return invoice;
    });

    this.logger.log(
      `Invoice ${invoiceNumber} created for customer ${customer.customerCode}`,
    );
    return result;
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      customerId?: string;
      status?: InvoiceStatus;
      packingListId?: string;
      dateFrom?: string;
      dateTo?: string;
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

        // Type assertion since findOne includes the relations
        const invoiceWithRelations = invoice as any;

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
            number: invoiceWithRelations.invoiceNumber,
            date: invoiceWithRelations.createdAt.toISOString().split('T')[0],
            dueDate: invoiceWithRelations.dueDate.toISOString().split('T')[0],
            status: invoiceWithRelations.status,
          },
          customer: {
            code: invoiceWithRelations.customer.customerCode,
            name: `${invoiceWithRelations.customer.firstName} ${
              invoiceWithRelations.customer.lastName
            }`,
            address: invoiceWithRelations.customer.address || '',
            phone: invoiceWithRelations.customer.phoneNumber || '',
            email: invoiceWithRelations.customer.email || '',
          },
          container: invoiceWithRelations.packingList?.container
            ? {
                number:
                  invoiceWithRelations.packingList.container.containerNumber,
                loadingDate: invoiceWithRelations.packingList.loadingDate
                  .toISOString()
                  .split('T')[0],
                origin:
                  invoiceWithRelations.packingList.container.departureCity
                    ?.name || 'Unknown',
                destination:
                  invoiceWithRelations.packingList.container.destinationCity
                    ?.name || 'Unknown',
              }
            : undefined,
          package: invoiceWithRelations.package
            ? {
                trackingCode: invoiceWithRelations.package.trackingCode,
                description: invoiceWithRelations.package.description,
                shippingMode: invoiceWithRelations.package.shippingMode,
                airType: invoiceWithRelations.package.airShippingType,
                quantity: invoiceWithRelations.package.quantity,
                weightKg: invoiceWithRelations.package.weight,
                cbm: invoiceWithRelations.package.cbm,
                destinationCity: invoiceWithRelations.package.destinationCity,
                warehouse: invoiceWithRelations.package.warehouse?.name,
              }
            : undefined,
          // Use package items directly
          items:
            invoiceWithRelations.package?.items?.map((item) => ({
              description: item.description || '',
              quantity: item.quantity,
              unitPrice:
                invoiceWithRelations.package.shippingMode === 'SEA'
                  ? (item.cbm || 0) *
                    (invoiceWithRelations.totalAmount /
                      (invoiceWithRelations.package.quantity || 1))
                  : (item.weight || 0) *
                    (invoiceWithRelations.totalAmount /
                      (invoiceWithRelations.package.quantity || 1)),
              total:
                (invoiceWithRelations.totalAmount /
                  (invoiceWithRelations.package.quantity || 1)) *
                item.quantity,
            })) || [],
          totals: {
            total: invoiceWithRelations.totalAmount,
            paid: invoiceWithRelations.paidAmount || 0,
            balance: invoiceWithRelations.balance,
            currency: invoiceWithRelations.currency,
          },
          currency: invoiceWithRelations.currency,
          notes: `Generated for Packing List: ${
            invoiceWithRelations.packingList?.name || 'N/A'
          }`,
        };

        // Generate PDF
        const pdfResult = await this.pdfService.generateInvoicePDF(pdfData);

        // Update invoice with PDF key in transaction
        await this.prisma.invoice.update({
          where: { id: invoiceWithRelations.id },
          data: { invoicePdfKey: pdfResult.key },
        });

        this.logger.log(
          `PDF generated on-demand for invoice ${invoiceWithRelations.invoiceNumber} - Key: ${pdfResult.key}`,
        );

        return this.pdfService.generateSignedDownloadUrl(pdfResult.key);
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
}
