import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Prisma, PackageStatus, ShippingMode } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { IdGeneratorService } from '../../shared/utils/id-generator.service';

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    private readonly idGeneratorService: IdGeneratorService,
  ) {}

  async create(createPackageDto: CreatePackageDto, userId: string) {
    const { photos, ...packageData } = createPackageDto;

    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: packageData.customerId },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${packageData.customerId} not found`,
      );
    }

    // Validate air shipping type is provided for air mode
    if (
      packageData.shippingMode === ShippingMode.AIR &&
      !packageData.airShippingType
    ) {
      throw new BadRequestException(
        'Air shipping type is required for AIR shipping mode',
      );
    }

    // Generate tracking code if not provided
    let trackingCode = packageData.trackingCode;
    if (!trackingCode) {
      trackingCode =
        await this.idGeneratorService.generatePackageTrackingCode();
    } else {
      // Validate provided tracking code format
      if (!this.idGeneratorService.validateTrackingCodeFormat(trackingCode)) {
        throw new BadRequestException(
          'Invalid tracking code format. Tracking code must be at least 3 characters long.',
        );
      }

      // Check if provided tracking code is unique
      const existingPackage = await this.prisma.package.findUnique({
        where: { trackingCode },
      });

      if (existingPackage) {
        throw new BadRequestException(
          `Tracking code ${trackingCode} already exists`,
        );
      }
    }

    // Create package with photos in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const newPackage = await tx.package.create({
        data: {
          ...packageData,
          trackingCode,
          createdById: userId,
          photos: {
            create: photos,
          },
        },
        include: {
          customer: true,
          photos: true,
          packingList: true,
          invoice: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entity: 'Package',
          entityId: newPackage.id,
          after: newPackage as any,
        },
      });

      return newPackage;
    });

    // Send notification for package intake
    try {
      await this.notificationsService.notifyPackageIntake(result);
    } catch (error) {
      this.logger.error('Failed to send package intake notification', error);
      // Don't fail the operation if notification fails
    }

    this.logger.log(
      `Package created with tracking code: ${result.trackingCode}`,
    );
    return result;
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      customerId?: string;
      status?: PackageStatus;
      packingListId?: string;
      paymentStatus?: string;
      search?: string;
    },
  ) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.PackageWhereInput = {};

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.packingListId) {
      where.packingListId = filters.packingListId;
    }

    if (filters?.paymentStatus) {
      where.paymentStatus = filters.paymentStatus as any;
    }

    if (filters?.search) {
      where.OR = [
        { trackingCode: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.package.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: true,
          photos: true,
          packingList: {
            include: {
              container: true,
            },
          },
          invoice: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.package.count({ where }),
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

  async findOne(id: string) {
    const packageRecord = await this.prisma.package.findUnique({
      where: { id },
      include: {
        customer: true,
        photos: true,
        packingList: {
          include: {
            container: true,
          },
        },
        invoice: {
          include: {
            payments: true,
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
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!packageRecord) {
      throw new NotFoundException(`Package with ID ${id} not found`);
    }

    return packageRecord;
  }

  async findByTrackingCode(trackingCode: string) {
    const packageRecord = await this.prisma.package.findUnique({
      where: { trackingCode },
      include: {
        customer: true,
        photos: true,
        packingList: {
          include: {
            container: true,
          },
        },
        invoice: {
          include: {
            payments: true,
          },
        },
      },
    });

    if (!packageRecord) {
      throw new NotFoundException(
        `Package with tracking code ${trackingCode} not found`,
      );
    }

    return packageRecord;
  }

  async update(id: string, updatePackageDto: UpdatePackageDto, userId: string) {
    const existingPackage = await this.findOne(id);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPackage = await tx.package.update({
        where: { id },
        data: {
          ...updatePackageDto,
          updatedById: userId,
        },
        include: {
          customer: true,
          photos: true,
          packingList: true,
          invoice: true,
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'Package',
          entityId: id,
          before: existingPackage as any,
          after: updatedPackage as any,
        },
      });

      return updatedPackage;
    });

    this.logger.log(`Package ${result.trackingCode} updated by user ${userId}`);
    return result;
  }

  async updateStatus(id: string, status: PackageStatus, userId: string) {
    const existingPackage = await this.findOne(id);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPackage = await tx.package.update({
        where: { id },
        data: {
          status,
          updatedById: userId,
        },
        include: {
          customer: true,
          photos: true,
          packingList: true,
          invoice: true,
        },
      });

      // Log the status change
      await tx.auditLog.create({
        data: {
          userId,
          action: 'STATUS_CHANGE',
          entity: 'Package',
          entityId: id,
          before: { status: existingPackage.status },
          after: { status },
          metadata: {
            oldStatus: existingPackage.status,
            newStatus: status,
          },
        },
      });

      return updatedPackage;
    });

    // Send notification for status change
    if (existingPackage.status !== status) {
      try {
        await this.notificationsService.notifyShipmentUpdate(
          result,
          existingPackage.status,
        );
      } catch (error) {
        this.logger.error('Failed to send shipment update notification', error);
        // Don't fail the operation if notification fails
      }
    }

    this.logger.log(
      `Package ${result.trackingCode} status changed from ${existingPackage.status} to ${status}`,
    );
    return result;
  }

  async addPhoto(
    id: string,
    photo: { url: string; key: string },
    userId: string,
  ) {
    await this.findOne(id); // Verify package exists

    const result = await this.prisma.$transaction(async (tx) => {
      const newPhoto = await tx.packagePhoto.create({
        data: {
          packageId: id,
          ...photo,
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'Package',
          entityId: id,
          metadata: {
            action: 'PHOTO_ADDED',
            photoId: newPhoto.id,
          },
        },
      });

      return newPhoto;
    });

    this.logger.log(`Photo added to package ${id}`);
    return result;
  }

  async removePhoto(id: string, photoId: string, userId: string) {
    // Ensure at least one photo remains
    const photoCount = await this.prisma.packagePhoto.count({
      where: { packageId: id },
    });

    if (photoCount <= 1) {
      throw new BadRequestException(
        'Cannot remove the last photo. At least one photo is required.',
      );
    }

    const photo = await this.prisma.packagePhoto.findFirst({
      where: {
        id: photoId,
        packageId: id,
      },
    });

    if (!photo) {
      throw new NotFoundException(
        `Photo with ID ${photoId} not found for this package`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.packagePhoto.delete({
        where: { id: photoId },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'Package',
          entityId: id,
          metadata: {
            action: 'PHOTO_REMOVED',
            photoId: photoId,
            photoKey: photo.key,
          },
        },
      });
    });

    this.logger.log(`Photo ${photoId} removed from package ${id}`);
    return { success: true };
  }

  async remove(id: string, userId: string) {
    const existingPackage = await this.findOne(id);

    // Check if package can be deleted (not in a packing list or has payments)
    if (existingPackage.packingListId) {
      throw new BadRequestException(
        'Cannot delete package that is in a packing list',
      );
    }

    if (existingPackage.paymentStatus !== 'PENDING') {
      throw new BadRequestException('Cannot delete package that has payments');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete photos first
      await tx.packagePhoto.deleteMany({
        where: { packageId: id },
      });

      // Delete the package
      await tx.package.delete({
        where: { id },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELETE',
          entity: 'Package',
          entityId: id,
          before: existingPackage as any,
        },
      });
    });

    this.logger.log(
      `Package ${existingPackage.trackingCode} deleted by user ${userId}`,
    );
    return { success: true };
  }

  async getWarehousePackages(daysThreshold?: number) {
    const where: Prisma.PackageWhereInput = {
      status: 'IN_WAREHOUSE',
    };

    if (daysThreshold) {
      where.daysInWarehouse = {
        gte: daysThreshold,
      };
    }

    return this.prisma.package.findMany({
      where,
      include: {
        customer: true,
        photos: true,
      },
      orderBy: {
        daysInWarehouse: 'desc',
      },
    });
  }

  async updateWarehouseDays() {
    // This could be run as a cron job to update days in warehouse
    const packages = await this.prisma.package.findMany({
      where: {
        status: 'IN_WAREHOUSE',
      },
    });

    const updates = packages.map((pkg) => {
      const days = Math.floor(
        (new Date().getTime() - new Date(pkg.receivedDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      return this.prisma.package.update({
        where: { id: pkg.id },
        data: { daysInWarehouse: days },
      });
    });

    await Promise.all(updates);
    this.logger.log(`Updated warehouse days for ${updates.length} packages`);
  }
}
