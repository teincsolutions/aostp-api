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
import { Prisma, Invoice, InvoiceStatus, ShippingMode } from '@prisma/client';
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
    // Get packing list with packages grouped by customer
    const packingList = await this.prisma.packingList.findUnique({
      where: { id: packingListId },
      include: {
        packages: {
          include: {
            customer: true,
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

    // Note: Currency conversion removed - per Use Case rule, FX only at payment time

    // Group packages by customer
    const packagesByCustomer = packingList.packages.reduce((acc, pkg) => {
      const customerId = pkg.customerId;
      if (!acc[customerId]) {
        acc[customerId] = {
          customer: pkg.customer,
          packages: [],
        };
      }
      acc[customerId].packages.push(pkg);
      return acc;
    }, {});

    const invoices: Invoice[] = [];

    // Generate invoice for each customer
    for (const [customerId, data] of Object.entries(packagesByCustomer)) {
      const { customer, packages } = data as {
        customer: any;
        packages: any[];
      };

      // Check if invoice already exists for this customer and packing list
      const existingInvoice = await this.prisma.invoice.findFirst({
        where: {
          customerId,
          packingListId,
        },
      });

      if (existingInvoice) {
        this.logger.warn(
          `Invoice already exists for customer ${customer.customerCode} and packing list ${packingList.name}`,
        );
        continue;
      }

      // Calculate totals
      let totalAmount = 0;
      for (const pkg of packages) {
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

      // Generate invoice number
      const invoiceNumber =
        await this.idGeneratorService.generateInvoiceNumber();

      // Calculate due date (30 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const result = await this.prisma.$transaction(async (tx) => {
        // Create invoice - NO currency conversion at invoice time per Use Case rule
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            customerId,
            packingListId,
            totalAmount,
            currency: 'USD',
            localAmount: 0, // FX deferred to payment time
            status: InvoiceStatus.UNPAID,
            dueDate,
            balance: totalAmount, // Initial balance equals total amount
          },
          include: {
            customer: true,
            packingList: {
              include: {
                container: true,
              },
            },
            packages: true,
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
              customerCode: customer.customerCode,
              packageCount: packages.length,
              generatedFromPackingList: true,
            },
          },
        });

        return invoice;
      });

      invoices.push(result);

      this.logger.log(
        `Invoice ${invoiceNumber} generated for customer ${customer.customerCode} - Amount: ${totalAmount} USD`,
      );
    }

    return invoices;
  }

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV${year}`;

    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastSequence = parseInt(
        lastInvoice.invoiceNumber.replace(prefix, ''),
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }

  private async getShippingRate(
    shippingMode: ShippingMode,
    airShippingType?: any,
  ): Promise<number> {
    const rate = await this.prisma.shippingRate.findFirst({
      where: {
        shippingMode,
        airShippingType: airShippingType || null,
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
          packages: true,
        },
      });

      // Update packages to link to this invoice
      await tx.package.updateMany({
        where: {
          id: { in: packingList.packages.map((pkg) => pkg.id) },
        },
        data: {
          invoiceId: invoice.id,
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
          packages: {
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
            container: true,
          },
        },
        packages: true,
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
          packages: true,
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
          packages: {
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
          packages: true,
        },
      });

      // Update package payment status
      await tx.package.updateMany({
        where: { invoiceId: id },
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
      await tx.package.updateMany({
        where: { invoiceId: id },
        data: { invoiceId: null },
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

    if (!invoice.invoicePdfKey) {
      throw new NotFoundException(
        `PDF not available for invoice ${invoice.invoiceNumber}`,
      );
    }

    return this.pdfService.generateSignedDownloadUrl(invoice.invoicePdfKey);
  }
}
