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
    const { invoiceId, trackingCode, receiverName, quantity, notes, photos } =
      createDeliveryDto;

    // Find the invoice with its package
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
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

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    if (!invoice.package) {
      throw new BadRequestException(
        'Invoice does not have an associated package',
      );
    }

    const pkg = invoice.package;

    if (pkg.trackingCode !== trackingCode) {
      throw new NotFoundException(
        `Package with tracking code ${trackingCode} not found for the provided invoice`,
      );
    }

    // Check if delivery already exists for this package
    const existingDelivery = await this.prisma.packageDelivery.findUnique({
      where: { packageId: pkg.id },
    });

    if (existingDelivery) {
      throw new BadRequestException(
        `Package with tracking code ${trackingCode} already delivered`,
      );
    }

    // Generate delivery ID
    const deliveryId =
      await this.idGeneratorService.generatePackageDeliveryId();

    const delivery = await this.prisma.$transaction(async (tx) => {
      // Create delivery record
      const created = await tx.packageDelivery.create({
        data: {
          deliveryId,
          customerId: invoice.customerId,
          invoiceId,
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
            customerCode: invoice.customer.customerCode,
            packageTrackingCode: trackingCode,
            quantity: created.quantity,
          },
          metadata: {
            invoiceId,
            receiverName,
            warehouseId: pkg.warehouseId,
            trackingCode,
          },
        },
      });

      return created;
    });

    // Send delivery notification
    try {
      await this.notificationsService.notifyDeliveryReleased(
        invoice.customer,
        delivery.package,
        delivery,
      );
    } catch (error) {
      this.logger.error('Failed to send delivery notification', error);
    }

    this.logger.log(
      `Delivery record created: ${deliveryId} for package ${trackingCode}`,
    );

    return delivery;
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
}
