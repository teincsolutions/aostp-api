import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { IdGeneratorService } from '../../shared/utils/id-generator.service';
import { Package, Prisma, ShippingMode } from '@prisma/client';

@Injectable()
export class ConsolidationService {
  private readonly logger = new Logger(ConsolidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idGeneratorService: IdGeneratorService,
  ) {}

  async consolidatePackages(
    sourceTrackingCodes: string[],
    targetTrackingCode: string,
    userId: string,
  ) {
    // Validate all source packages exist and are eligible
    const sourcePackages = await this.prisma.package.findMany({
      where: {
        trackingCode: { in: sourceTrackingCodes },
      },
      include: {
        items: true,
        customer: true,
        photos: true,
      },
    });

    if (sourcePackages.length !== sourceTrackingCodes.length) {
      throw new BadRequestException('Some source packages not found');
    }

    // Check eligibility - must be the same customer, not already consolidated, not shipped
    const firstCustomerId = sourcePackages[0].customerId;
    const shippingMode = sourcePackages[0].shippingMode;
    const airShippingType = sourcePackages[0].airShippingType;
    const warehouseId = sourcePackages[0].warehouseId;
    const destinationCityId = sourcePackages[0].destinationCityId;

    for (const pkg of sourcePackages) {
      if (pkg.customerId !== firstCustomerId) {
        throw new BadRequestException(
          'All packages must belong to the same customer',
        );
      }
      if (pkg.isConsolidated) {
        throw new BadRequestException(
          `Package ${pkg.trackingCode} is already consolidated`,
        );
      }
      if (pkg.shippingMode !== shippingMode) {
        throw new BadRequestException(
          'All packages must have the same shipping mode',
        );
      }
      if (pkg.airShippingType !== airShippingType) {
        throw new BadRequestException(
          'All packages must have the same air shipping type',
        );
      }
      if (pkg.warehouseId !== warehouseId) {
        throw new BadRequestException(
          'All packages must have the same warehouse',
        );
      }
      if (pkg.destinationCityId !== destinationCityId) {
        throw new BadRequestException(
          'All package must have the same destination city',
        );
      }

      if (!['RECEIVED', 'IN_WAREHOUSE'].includes(pkg.status)) {
        throw new BadRequestException(
          `Package ${pkg.trackingCode} has invalid status for consolidation`,
        );
      }
    }

    // Check target tracking code doesn't exist
    const existingPackage: Package | null =
      await this.prisma.package.findUnique({
        where: { trackingCode: targetTrackingCode },
      });
    if (existingPackage) {
      throw new BadRequestException(
        `Tracking code ${targetTrackingCode} already exists`,
      );
    }

    // Calculate totals from package items
    const newDescription = `Consolidated package - ${sourcePackages.map((pkg) => pkg.description).join(', ')}`;
    const totalWeight = sourcePackages.reduce(
      (sum, item) => sum + (item.weight || 0),
      0,
    );
    const totalCBM = sourcePackages.reduce(
      (sum, item) => sum + (item.cbm || 0),
      0,
    );
    const totalQuantity = sourcePackages.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    const daysInWarehouse = sourcePackages.reduce(
      (sum, pkg) => sum + (pkg.daysInWarehouse || 0),
      0,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      // Create consolidated parent package
      const parentPackage = await tx.package.create({
        data: {
          trackingCode: targetTrackingCode,
          customerId: firstCustomerId,
          description: newDescription,
          weight: totalWeight,
          cbm: totalCBM,
          quantity: totalQuantity,
          shippingMode,
          airShippingType,
          isConsolidated: true,
          status: 'IN_WAREHOUSE',
          warehouseId,
          notes: `Consolidation of packages: ${sourceTrackingCodes.join(', ')}`,
          receivedDate: new Date(),
          daysInWarehouse,
          photos: {
            create: sourcePackages.flatMap((p) =>
              (p.photos || []).map((photo) => ({
                url: photo.url,
                key: photo.key,
                uploadedAt: photo.uploadedAt,
              })),
            ),
          },
          createdById: userId,
        },
      });

      // Link all package items to the parent package
      for (const item of sourcePackages) {
        await tx.packageItem.create({
          data: {
            packageId: parentPackage.id,
            // include required fields from the source package
            intakeTrackingCode: item.trackingCode,
            customerId: item.customerId,
            warehouseId: item.warehouseId || '',
            shippingMode: item.shippingMode,
            airShippingType: item.airShippingType,
            intakePhotos: {
              create: (item.photos || []).map((photo) => ({
                url: photo.url,
                key: photo.key,
                uploadedAt: photo.uploadedAt,
              })),
            },
            description: item.description,
            weight: item.weight,
            cbm: item.cbm,
            quantity: item.quantity,
            notes: item.notes,
            intakeDate: item.receivedDate || new Date(),
          },
        });
      }

      // Delete old single packages
      await tx.package.deleteMany({
        where: {
          id: { in: sourcePackages.map((p) => p.id) },
        },
      });

      // Log the consolidation action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CONSOLIDATION',
          entity: 'Package',
          entityId: parentPackage.id,
          after: {
            trackingCode: targetTrackingCode,
            sourcePackages: sourceTrackingCodes,
            totalWeight,
            totalCBM,
            itemCount: sourcePackages.length,
          },
          metadata: {
            action: 'PACKAGE_CONSOLIDATION',
            sourceTrackingCodes,
            targetTrackingCode,
            totalWeight,
            totalCBM,
            totalQuantity,
          },
        },
      });

      return {
        parentPackage,
        consolidatedPackages: sourcePackages.map((p) => ({
          id: p.id,
          trackingCode: p.trackingCode,
        })),
      };
    });

    this.logger.log(
      `Consolidated ${sourceTrackingCodes.length} packages into ${targetTrackingCode}`,
    );

    return result;
  }

  async getPackagesForConsolidation(
    customerId: string,
    shippingMode?: ShippingMode,
  ) {
    const where: Prisma.PackageWhereInput = {
      customerId,
      status: { in: ['RECEIVED', 'IN_WAREHOUSE'] },
      isConsolidated: false,
    };

    if (shippingMode) {
      where.shippingMode = shippingMode;
    }

    return this.prisma.package.findMany({
      where,
      include: {
        items: {
          select: {
            id: true,
            description: true,
            weight: true,
            cbm: true,
            quantity: true,
          },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
