import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreatePackageDeliveryDto } from './dto/create-package-delivery.dto';
import { IdGeneratorService } from '../../shared/utils/id-generator.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PackageDeliveryService {
  private readonly logger = new Logger(PackageDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idGeneratorService: IdGeneratorService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createDelivery(
    createDeliveryDto: CreatePackageDeliveryDto,
    userId: string,
  ) {
    const { invoiceIds, trackingCodes, receiverName, quantity, notes, photos } =
      createDeliveryDto;

    // Validate that we have at least one invoice
    if (invoiceIds.length === 0) {
      throw new BadRequestException('At least one invoice ID must be provided');
    }

    // Find all invoices with their packages
    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      include: {
        customer: true,
        package: {
          include: {
            warehouse: true,
          },
        },
        packingList: {
          include: {
            container: true,
          },
        },
      },
    });

    if (invoices.length === 0) {
      throw new NotFoundException('No invoices found with the provided IDs');
    }

    if (invoices.length !== invoiceIds.length) {
      const foundIds = invoices.map((inv) => inv.id);
      const missingIds = invoiceIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Invoices not found: ${missingIds.join(', ')}`,
      );
    }

    // Verify all invoices belong to the same customer
    const customerIds = [...new Set(invoices.map((inv) => inv.customerId))];
    if (customerIds.length > 1) {
      throw new BadRequestException(
        'All invoices must belong to the same customer for a single pickup',
      );
    }

    const customerId = customerIds[0];
    const customer = invoices[0].customer;

    // Build a map of tracking codes to packages from invoices
    const packagesByTrackingCode = new Map<string, any>();
    const invoiceByPackageId = new Map<string, any>();
    const allPackages: any[] = [];

    for (const invoice of invoices) {
      if (!invoice.package) {
        throw new BadRequestException(
          `Invoice ${invoice.invoiceNumber} does not have an associated package`,
        );
      }
      packagesByTrackingCode.set(invoice.package.trackingCode, invoice.package);
      invoiceByPackageId.set(invoice.package.id, invoice);
      allPackages.push(invoice.package);
    }

    // Determine which packages to deliver
    let packagesToDeliver: any[];

    if (trackingCodes && trackingCodes.length > 0) {
      // If tracking codes are provided, validate and use only those packages
      const missingTrackingCodes = trackingCodes.filter(
        (code) => !packagesByTrackingCode.has(code),
      );
      if (missingTrackingCodes.length > 0) {
        throw new NotFoundException(
          `Packages not found in provided invoices: ${missingTrackingCodes.join(', ')}`,
        );
      }
      packagesToDeliver = trackingCodes.map((code) =>
        packagesByTrackingCode.get(code),
      );
    } else {
      // If no tracking codes provided, pick up all packages from the invoices
      packagesToDeliver = allPackages;
    }

    // Check for existing deliveries
    const packageIds = packagesToDeliver.map((pkg) => pkg.id);

    const existingDeliveries = await this.prisma.packageDelivery.findMany({
      where: { packageId: { in: packageIds } },
    });

    if (existingDeliveries.length > 0) {
      const alreadyDelivered = existingDeliveries.map((del) => {
        const pkg = packagesToDeliver.find((p) => p.id === del.packageId);
        return pkg?.trackingCode;
      });
      throw new BadRequestException(
        `Packages already delivered: ${alreadyDelivered.join(', ')}`,
      );
    }

    // Create deliveries for all packages in a transaction
    const deliveries = await this.prisma.$transaction(async (tx) => {
      const createdDeliveries: any[] = [];

      for (const pkg of packagesToDeliver) {
        const invoice = invoiceByPackageId.get(pkg.id);

        // Generate delivery ID
        const deliveryId =
          await this.idGeneratorService.generatePackageDeliveryId();

        // Create delivery record
        const created = await tx.packageDelivery.create({
          data: {
            deliveryId,
            customerId,
            invoiceId: invoice.id,
            packageId: pkg.id,
            receiverName,
            quantity: quantity || pkg.quantity,
            warehouseId: pkg.warehouseId || '',
            notes,
            photos,
            createdById: userId,
          },
          include: {
            customer: true,
            package: {
              include: {
                warehouse: true,
              },
            },
            invoice: true,
          },
        });

        // Update package status to RELEASED
        await tx.package.update({
          where: { id: pkg.id },
          data: { status: 'RELEASED' },
        });

        // Log the delivery action
        await tx.auditLog.create({
          data: {
            userId,
            action: 'CREATE',
            entity: 'PackageDelivery',
            entityId: created.id,
            after: {
              deliveryId: created.deliveryId,
              customerCode: customer.customerCode,
              packageTrackingCode: pkg.trackingCode,
              quantity: created.quantity,
            },
            metadata: {
              invoiceId: invoice.id,
              receiverName,
              warehouseId: pkg.warehouseId,
              trackingCode: pkg.trackingCode,
            },
          },
        });

        createdDeliveries.push(created);
      }

      return createdDeliveries;
    });

    // Send delivery notifications for each package
    for (const delivery of deliveries) {
      try {
        await this.notificationsService.notifyDeliveryReleased(
          customer,
          delivery.package,
          delivery,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send delivery notification for ${delivery.package.trackingCode}`,
          error,
        );
      }
    }

    this.logger.log(
      `Created ${deliveries.length} delivery records for customer ${customer.customerCode}`,
    );

    return {
      success: true,
      count: deliveries.length,
      deliveries: deliveries.map((d) => ({
        id: d.id,
        deliveryId: d.deliveryId,
        invoiceId: d.invoiceId,
        packageId: d.packageId,
        trackingCode: d.package.trackingCode,
        quantity: d.quantity,
        releaseDate: d.releaseDate,
      })),
    };
  }

  async getDeliveriesByInvoice(invoiceId: string) {
    return this.prisma.packageDelivery.findMany({
      where: { invoiceId },
      include: {
        package: {
          include: {
            warehouse: true,
          },
        },
        customer: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { releaseDate: 'desc' },
    });
  }

  async getCustomerDeliveries(customerId: string) {
    return this.prisma.packageDelivery.findMany({
      where: { customerId },
      include: {
        package: {
          include: {
            warehouse: true,
          },
        },
        invoice: {
          include: {
            packingList: {
              include: {
                container: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { releaseDate: 'desc' },
    });
  }

  async getDeliveryById(deliveryId: string) {
    const delivery = await this.prisma.packageDelivery.findUnique({
      where: { deliveryId },
      include: {
        customer: true,
        invoice: {
          include: {
            packingList: {
              include: {
                container: true,
              },
            },
          },
        },
        package: {
          include: {
            warehouse: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${deliveryId} not found`);
    }

    return delivery;
  }

  async getAllDeliveries(
    pagination: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    filters: {
      customerId?: string;
      invoiceId?: string;
      packageId?: string;
      trackingCode?: string;
      warehouseId?: string;
      packingListId?: string;
      deliveryId?: string;
      receiverName?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const sortBy = pagination.sortBy || 'releaseDate';
    const sortOrder = pagination.sortOrder || 'desc';

    const where: any = {};

    // Direct filters
    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.invoiceId) {
      where.invoiceId = filters.invoiceId;
    }

    if (filters.packageId) {
      where.packageId = filters.packageId;
    }

    if (filters.deliveryId) {
      where.deliveryId = {
        contains: filters.deliveryId,
        mode: 'insensitive',
      };
    }

    if (filters.receiverName) {
      where.receiverName = {
        contains: filters.receiverName,
        mode: 'insensitive',
      };
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      where.releaseDate = {};
      if (filters.dateFrom) {
        where.releaseDate.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.releaseDate.lte = toDate;
      }
    }

    // Nested filters through relationships
    if (filters.trackingCode) {
      where.package = {
        trackingCode: {
          contains: filters.trackingCode,
          mode: 'insensitive',
        },
      };
    }

    if (filters.warehouseId) {
      where.package = {
        ...where.package,
        warehouseId: filters.warehouseId,
      };
    }

    if (filters.packingListId) {
      where.invoice = {
        packingListId: filters.packingListId,
      };
    }

    // Get total count
    const total = await this.prisma.packageDelivery.count({ where });

    // Get paginated data
    const deliveries = await this.prisma.packageDelivery.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            packingList: {
              select: {
                id: true,
                name: true,
                container: {
                  select: {
                    id: true,
                    containerNumber: true,
                    destinationCity: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        package: {
          select: {
            id: true,
            trackingCode: true,
            warehouse: {
              select: {
                id: true,
                warehouseId: true,
                name: true,
                location: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: deliveries,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}
