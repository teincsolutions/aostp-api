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
import {
  Prisma,
  PackageStatus,
  ShippingMode,
  AirShippingType,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { IdGeneratorService } from '../../shared/utils/id-generator.service';
import { PDFService } from '../../providers/pdf/pdf.service';
import { ConfigService } from '@nestjs/config';
import { roundToTwoDecimals } from '../../shared/utils/decimal.utils';

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PDFService,
    private readonly notificationsService: NotificationsService,
    private readonly idGeneratorService: IdGeneratorService,
    private readonly configService: ConfigService,
  ) {}

  async create(createPackageDto: CreatePackageDto, userId: string) {
    const { photos, warehouseId, ...packageData } = createPackageDto;

    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: packageData.customerId },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${packageData.customerId} not found`,
      );
    }

    // Validate warehouse if specified
    let warehouse;
    if (warehouseId) {
      warehouse = await this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
      });
      if (!warehouse) {
        throw new NotFoundException(
          `Warehouse with ID ${warehouseId} not found`,
        );
      }
    } else {
      // Default to first active warehouse
      warehouse = await this.prisma.warehouse.findFirst({
        where: { isActive: true },
      });
      if (!warehouse) {
        throw new BadRequestException('No active warehouse found');
      }
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

    // Auto-generate tracking code if not provided
    let packageTrackingCode = packageData.trackingCode;
    if (!packageTrackingCode) {
      packageTrackingCode =
        this.idGeneratorService.generateConsolidatedPackageTrackingCode();
      this.logger.log(`Auto-generated tracking code: ${packageTrackingCode}`);
    } else {
      // Validate provided tracking code format
      if (
        !this.idGeneratorService.validateTrackingCodeFormat(packageTrackingCode)
      ) {
        throw new BadRequestException(
          'Invalid tracking code format. Tracking code must be at least 3 characters long.',
        );
      }
    }

    // Auto-calculate shippingCost if shippingRate is provided but no shippingCost
    let finalShippingCost = packageData.shippingCost
      ? roundToTwoDecimals(packageData.shippingCost)
      : undefined;
    if (
      packageData.shippingRate !== undefined &&
      finalShippingCost === undefined
    ) {
      const shippingRate = roundToTwoDecimals(packageData.shippingRate);
      let units = 0;

      if (packageData.shippingMode === ShippingMode.SEA) {
        units = packageData.cbm || 0;
      } else {
        units = packageData.weight || 0;
      }

      finalShippingCost = roundToTwoDecimals(
        shippingRate * units * packageData.quantity,
      );
    }

    // Check if provided tracking code is unique
    const existingPackage = await this.prisma.package.findUnique({
      where: { trackingCode: packageTrackingCode },
    });

    if (existingPackage) {
      throw new BadRequestException(
        `Tracking code ${packageTrackingCode} already exists`,
      );
    }

    // Create package in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create package (simplified - single package without PackageItem complexity)
      const newPackage = await tx.package.create({
        data: {
          trackingCode: packageTrackingCode,
          customerId: packageData.customerId,
          warehouseId: warehouse.id,
          description: packageData.description,
          weight: packageData.weight,
          cbm: packageData.cbm,
          quantity: packageData.quantity,
          destinationCityId: packageData.destinationCityId,
          shippingRate: packageData.shippingRate
            ? roundToTwoDecimals(packageData.shippingRate)
            : undefined,
          shippingCurrency: packageData.shippingCurrency || 'USD',
          shippingCost: finalShippingCost,
          shippingMode: packageData.shippingMode,
          airShippingType: packageData.airShippingType,
          status: PackageStatus.RECEIVED,
          notes: packageData.notes,
          pickupCode: packageData.pickupCode,
          isConsolidated: false,
          createdById: userId,
          photos: {
            create: photos.map((photo) => ({
              url: photo.url,
              key: photo.key,
            })),
          },
        },
        include: {
          customer: true,
          warehouse: true,
          photos: true,
          packingList: true,
          invoice: true,
          items: true, // Keep for backward compatibility if needed
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
          metadata: {
            action: 'PACKAGE_INTAKE',
            trackingCode: packageTrackingCode,
          },
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

    // Generate package intake receipt PDF (run asynchronously after response)
    try {
      this.generatePackageReceipt(result, result.trackingCode).catch(
        (error) => {
          this.logger.error(
            `Failed to generate receipt for package ${result.trackingCode}`,
            error,
          );
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to start receipt generation for package ${result.trackingCode}`,
        error,
      );
      // Don't fail package creation if receipt generation fails
    }

    this.logger.log(`Package intake: Package ${result.trackingCode}`);
    return result;
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      customerId?: string;
      status?: PackageStatus;
      shippingMode?: ShippingMode;
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

    if (filters?.shippingMode) {
      where.shippingMode = filters.shippingMode;
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
        { pickupCode: { contains: filters.search, mode: 'insensitive' } },
        {
          items: {
            some: {
              intakeTrackingCode: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.package.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: true,
          warehouse: true,
          photos: true,
          invoice: true,
          items: true,
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
        warehouse: true,
        photos: true,
        packingList: {
          include: {
            container: true,
            warehouse: true,
          },
        },
        invoice: {
          include: {
            payments: true,
          },
        },
        items: {
          include: {
            intakePhotos: true,
            warehouse: true,
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
    const packageRecord = await this.prisma.package.findFirst({
      where: {
        OR: [
          { trackingCode },
          { items: { some: { intakeTrackingCode: trackingCode } } },
        ],
      },
      include: {
        customer: true,
        warehouse: true,
        photos: true,
        packingList: {
          include: {
            container: true,
            warehouse: true,
          },
        },
        invoice: {
          include: {
            payments: true,
          },
        },
        items: {
          include: {
            intakePhotos: true,
            warehouse: true,
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

    // Validate pickupCode uniqueness if provided
    if (
      updatePackageDto.pickupCode &&
      updatePackageDto.pickupCode !== existingPackage.pickupCode
    ) {
      const existingWithPickupCode = await this.prisma.package.findUnique({
        where: { pickupCode: updatePackageDto.pickupCode },
      });

      if (existingWithPickupCode) {
        throw new BadRequestException(
          `Pickup code ${updatePackageDto.pickupCode} already exists`,
        );
      }
    }

    // Auto-calculate shippingCost if shippingRate is provided and we have the necessary data
    let calculatedShippingCost = updatePackageDto.shippingCost
      ? roundToTwoDecimals(updatePackageDto.shippingCost)
      : undefined;
    if (
      updatePackageDto.shippingRate !== undefined &&
      !calculatedShippingCost
    ) {
      const pkg = existingPackage;
      const shippingRate = roundToTwoDecimals(updatePackageDto.shippingRate);

      // Determine shipping mode - use updated value if provided, otherwise use existing
      const shippingMode =
        updatePackageDto.shippingMode !== undefined
          ? updatePackageDto.shippingMode
          : pkg.shippingMode;

      // Determine quantity - use updated value if provided, otherwise use existing
      const quantity =
        updatePackageDto.quantity !== undefined
          ? updatePackageDto.quantity
          : pkg.quantity;

      let units = 0;

      if (shippingMode === ShippingMode.SEA) {
        // Use updated CBM if provided, otherwise use existing
        units =
          updatePackageDto.cbm !== undefined
            ? updatePackageDto.cbm
            : pkg.cbm || 0;
      } else {
        // Use updated weight if provided, otherwise use existing
        units =
          updatePackageDto.weight !== undefined
            ? updatePackageDto.weight
            : pkg.weight || 0;
      }

      calculatedShippingCost = roundToTwoDecimals(
        shippingRate * units * quantity,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updateData = {
        ...updatePackageDto,
        updatedById: userId,
        ...(calculatedShippingCost !== undefined && {
          shippingCost: calculatedShippingCost,
        }),
      };

      const updatedPackage = await tx.package.update({
        where: { id },
        data: updateData,
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

  async getWarehousePackages(
    filters?: {
      warehouseId?: string;
      status?: string;
      daysThreshold?: number;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
    paginationDto?: PaginationDto,
  ) {
    const { page = 1, limit = 10 } = paginationDto || {};
    const { sortBy = 'daysInWarehouse', sortOrder = 'desc' } =
      paginationDto || {};
    const skip = (page - 1) * limit;

    const where: Prisma.PackageWhereInput = {};

    // Apply default filter for warehouse packages if no status specified
    if (filters?.status) {
      where.status = filters.status as any;
    } else {
      where.status = PackageStatus.RECEIVED;
    }

    if (filters?.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }

    if (filters?.daysThreshold) {
      where.daysInWarehouse = {
        gte: filters.daysThreshold,
      };
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
      }
    }

    if (filters?.search) {
      where.OR = [
        { trackingCode: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
        { pickupCode: { contains: filters.search, mode: 'insensitive' } },
        {
          customer: {
            firstName: { contains: filters.search, mode: 'insensitive' },
          },
        },
        {
          customer: {
            lastName: { contains: filters.search, mode: 'insensitive' },
          },
        },
        {
          customer: {
            customerCode: { contains: filters.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.package.findMany({
        where,
        include: {
          customer: true,
          photos: true,
          warehouse: true,
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
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

  async updateWarehouseDays() {
    // This could be run as a cron job to update days in warehouse
    const packages = await this.prisma.package.findMany({
      where: {
        status: 'RECEIVED',
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

  /**
   * Get package receipt signed URL - with regen if not exists
   */
  async getReceiptUrl(packageId: string): Promise<{ url: string }> {
    const pkg = await this.findOne(packageId);

    if (!pkg) {
      throw new NotFoundException(`Package with ID ${packageId} not found`);
    }
    const cdnUrl = `https://${this.configService.get('CDN_DOMAIN')}`;
    const packageBucket = this.configService.get('AWS_PACKAGES_BUCKET_NAME');

    if (pkg.receiptKey) {
      return {
        url: `${cdnUrl}/${packageBucket}/${pkg.receiptKey}`,
      };
    }

    // Receipt doesn't exist or package has no receiptKey - regenerate
    this.logger.log(
      `Receipt not found for package ${pkg.trackingCode}, regenerating...`,
    );

    await this.generatePackageReceipt(
      pkg,
      pkg.items[0]?.intakeTrackingCode || '',
    );

    // Fetch updated package to get the new receipt key
    const updatedPkg = await this.findOne(packageId);
    if (!updatedPkg.receiptKey) {
      throw new BadRequestException('Failed to generate package receipt');
    }
    return {
      url: `${cdnUrl}/${packageBucket}/${updatedPkg.receiptKey}`,
    };
  }

  /**
   * Generate package intake receipt PDF asynchronously
   */
  private async generatePackageReceipt(
    pkg: any,
    trackingCode: string,
  ): Promise<void> {
    try {
      // Get company information from PDF service (config-based)
      const companyInfo = this.pdfService
        ? {
            name: 'AOSTP Logistics',
            address: 'Accra, Ghana',
            phone: '+233 XX XXX XXXX',
            email: 'info@aostp.com',
          }
        : {
            name: 'AOSTP Logistics',
            address: 'Accra, Ghana',
            phone: '+233 XX XXX XXXX',
            email: 'info@aostp.com',
          };

      // Use PackageIntakeData for package intake receipt (no payment info)
      const intakeData = {
        company: companyInfo,
        intake: {
          trackingCode: pkg.trackingCode,
          date: new Date().toLocaleDateString(),
          warehouse: pkg.warehouse?.name,
        },
        customer: {
          code: pkg.customer.customerCode,
          name: `${pkg.customer.firstName} ${pkg.customer.lastName}`,
          phone: pkg.customer.phoneNumber,
          email: pkg.customer.email || undefined,
        },
        package: {
          description: pkg.description,
          shippingMode: pkg.shippingMode,
          airType: pkg.airShippingType,
          quantity: pkg.quantity,
          weightKg: pkg.weight,
          cbm: pkg.cbm,
          destinationCity: pkg.destinationCity,
        },
        notes: pkg.notes,
        photos: pkg.photos || [],
      };

      const result = await this.pdfService.generatePackageIntakePDF(intakeData);

      // Update package with receipt key
      await this.prisma.package.update({
        where: { id: pkg.id },
        data: { receiptKey: result.key },
      });

      this.logger.log(
        `Package intake receipt generated for ${pkg.trackingCode}: ${result.key}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate package receipt for ${pkg.trackingCode}`,
        error,
      );
      throw error;
    }
  }
}
