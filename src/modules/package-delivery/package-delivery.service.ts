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
    const {
      invoiceId,
      packageItemIntakeTrackingCode,
      receiverName,
      quantity,
      notes,
      photos,
    } = createDeliveryDto;

    // Find the invoice
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        packingList: {
          include: {
            container: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    // Find the package item by intake tracking code
    const packageItem = await this.prisma.packageItem.findFirst({
      where: {
        intakeTrackingCode: packageItemIntakeTrackingCode,
      },
      include: {
        package: true,
        warehouse: true,
      },
    });

    if (!packageItem) {
      throw new NotFoundException(
        `Package item with intake tracking code ${packageItemIntakeTrackingCode} not found`,
      );
    }

    // Validate that the package item belongs to this invoice
    if (packageItem.packageId) {
      const packageInvoiceCheck = await this.prisma.package.findUnique({
        where: { id: packageItem.packageId },
        include: { invoice: true },
      });

      if (packageInvoiceCheck?.invoice?.id !== invoiceId) {
        throw new BadRequestException(
          'Package item does not belong to the specified invoice',
        );
      }
    } else {
      throw new BadRequestException(
        'Package item is not associated with any package',
      );
    }

    // Check if delivery already exists for this item
    const existingDelivery = await this.prisma.packageDelivery.findUnique({
      where: { packageItemId: packageItem.id },
    });

    if (existingDelivery) {
      throw new BadRequestException(
        'Delivery record already exists for this package item',
      );
    }

    // Generate delivery ID
    const deliveryId =
      await this.idGeneratorService.generatePackageDeliveryId();

    const result = await this.prisma.$transaction(async (tx) => {
      // Create delivery record
      const delivery = await tx.packageDelivery.create({
        data: {
          deliveryId,
          customerId: invoice.customerId,
          invoiceId,
          packageItemId: packageItem.id,
          receiverName,
          quantity: quantity || packageItem.quantity,
          warehouseId: packageItem.warehouseId,
          notes,
          photos,
          createdById: userId,
        },
        include: {
          customer: true,
          packageItem: {
            include: {
              package: true,
            },
          },
        },
      });

      // Update package status if all items are released (check if all items have deliveries)
      if (packageItem.packageId) {
        const allItems = await tx.packageItem.findMany({
          where: { packageId: packageItem.packageId },
          include: { delivery: true },
        });

        const allReleased = allItems.every((item) => item.delivery !== null);

        if (allReleased) {
          await tx.package.update({
            where: { id: packageItem.packageId },
            data: { status: 'RELEASED' },
          });
        }
      }

      // Log the delivery action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entity: 'PackageDelivery',
          entityId: delivery.id,
          after: {
            deliveryId,
            customerCode: invoice.customer.customerCode,
            packageItemIntakeTrackingCode,
            quantity: delivery.quantity,
          },
          metadata: {
            invoiceId,
            receiverName,
            warehouseId: packageItem.warehouseId,
          },
        },
      });

      return delivery;
    });

    // Send delivery notification
    if (result.packageItem.package) {
      try {
        await this.notificationsService.notifyDeliveryReleased(
          invoice.customer,
          result.packageItem.package,
          result,
        );
      } catch (error) {
        this.logger.error('Failed to send delivery notification', error);
      }
    }

    this.logger.log(
      `Delivery record created: ${deliveryId} for package item ${packageItemIntakeTrackingCode}`,
    );

    return result;
  }

  async getDeliveriesByInvoice(invoiceId: string) {
    return this.prisma.packageDelivery.findMany({
      where: { invoiceId },
      include: {
        packageItem: {
          include: {
            package: true,
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
        packageItem: {
          include: {
            package: true,
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
        packageItem: {
          include: {
            package: true,
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
}
