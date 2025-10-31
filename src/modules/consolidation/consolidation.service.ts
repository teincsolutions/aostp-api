import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { IdGeneratorService } from '../../shared/utils/id-generator.service';
import { Prisma, ShippingMode } from '@prisma/client';

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
      },
    });

    if (sourcePackages.length !== sourceTrackingCodes.length) {
      throw new BadRequestException('Some source packages not found');
    }

    // Check eligibility - must be the same customer, not already consolidated, not shipped
    const firstCustomerId = sourcePackages[0].customerId;
    const shippingMode = sourcePackages[0].shippingMode;
    const airShippingType = sourcePackages[0].airShippingType;

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
      if (!['RECEIVED', 'IN_WAREHOUSE'].includes(pkg.status)) {
        throw new BadRequestException(
          `Package ${pkg.trackingCode} has invalid status for consolidation`,
        );
      }
    }

    // Check target tracking code doesn't exist
    const existingPackage = await this.prisma.package.findUnique({
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
          createdById: userId,
        },
      });

      // Link all package items to the parent package
      await tx.packageItem.updateMany({
        where: {
          packageId: { in: sourcePackages.map((p) => p.id) },
        },
        data: {
          packageId: parentPackage.id,
          status: 'CONSOLIDATED',
        },
      });

      // Mark old single packages as consolidated children
      await tx.package.updateMany({
        where: {
          id: { in: sourcePackages.map((p) => p.id) },
        },
        data: {
          status: 'CONSOLIDATED',
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
        parentPackage: {
          id: parentPackage.id,
          trackingCode: parentPackage.trackingCode,
          totalWeight,
          totalCBM,
          totalQuantity,
          itemCount: sourcePackages.length,
        },
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
