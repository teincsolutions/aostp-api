import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreatePackingListDto } from './dto/create-packing-list.dto';
import { UpdatePackingListDto } from './dto/update-packing-list.dto';
import { GetPackingListsQueryDto } from './dto/get-packing-lists-query.dto';
import { Prisma, PackageStatus, ContainerStatus } from '@prisma/client';
import { IdGeneratorService } from '../../shared/utils/id-generator.service';
import { AddPackagesToPackingListDto } from './dto/add-packages.dto';

@Injectable()
export class PackingListsService {
  private readonly logger = new Logger(PackingListsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idGeneratorService: IdGeneratorService,
  ) {}

  async create(
    createPackingListDto: CreatePackingListDto,
    userId: string,
  ): Promise<any> {
    const {
      containerId,
      destinationCity,
      eta,
      loadingDate,
      name,
      notes,
      warehouseId,
    } = createPackingListDto;

    // Verify container exists
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
    });

    if (!container) {
      throw new NotFoundException(`Container with ID ${containerId} not found`);
    }

    // Validate container type restrictions for SEA vs AIR shipping
    // Container type should be enforced based on shipping mode
    // SEA = CONTAINER, AIR = BAG
    // Group by shipping mode to determine container type
    const shippingModeGroups = await this.prisma.package.groupBy({
      by: ['shippingMode'],
      where: {
        packingList: {
          containerId,
        },
      },
      _count: true,
    });

    // Enforce container type based on shipping modes
    const hasSeaPackages = shippingModeGroups.some(
      (g) => g.shippingMode === 'SEA',
    );
    const hasAirPackages = shippingModeGroups.some(
      (g) => g.shippingMode === 'AIR',
    );

    if (hasSeaPackages && hasAirPackages) {
      throw new BadRequestException(
        'Container cannot contain both SEA and AIR packages. Use separate containers.',
      );
    }

    if (hasSeaPackages && container.containerType !== 'CONTAINER') {
      throw new BadRequestException(
        'SEA packages must be loaded in CONTAINER type containers.',
      );
    }

    if (hasAirPackages && container.containerType !== 'BAG') {
      throw new BadRequestException(
        'AIR packages must be loaded in BAG type containers.',
      );
    }

    // Generate name if not provided (default to loading date + container number)
    const packingListName =
      name ||
      this.idGeneratorService.generatePackingListName(
        new Date(loadingDate),
        container.containerNumber,
      );

    // Check if name is unique
    const existingPackingList = await this.prisma.packingList.findUnique({
      where: { name: packingListName },
    });

    if (existingPackingList) {
      throw new BadRequestException(
        `Packing list with name '${packingListName}' already exists`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const packingList = await tx.packingList.create({
        data: {
          name: packingListName,
          containerId,
          destinationCity,
          eta: eta ? new Date(eta) : null,
          warehouseId,
          loadingDate: new Date(loadingDate),
          notes,
        },
        include: {
          container: true,
          packages: {
            include: {
              customer: true,
            },
          },
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entity: 'PackingList',
          entityId: packingList.id,
          after: packingList as any,
        },
      });

      return packingList;
    });

    this.logger.log(`Packing list '${packingListName}' created`);
    return result;
  }

  async findAll(queryDto: GetPackingListsQueryDto) {
    const { page = 1, limit = 20, sortBy, sortOrder } = queryDto;
    const skip = (page - 1) * limit;

    const where: Prisma.PackingListWhereInput = {};

    if (queryDto.containerId) {
      where.containerId = queryDto.containerId;
    }

    if (queryDto.containerStatus) {
      where.container = {
        status: queryDto.containerStatus,
      };
    }

    if (queryDto.status) {
      where.status = queryDto.status;
    }

    if (queryDto.dateFrom || queryDto.dateTo) {
      where.loadingDate = {};
      if (queryDto.dateFrom) {
        where.loadingDate.gte = new Date(queryDto.dateFrom);
      }
      if (queryDto.dateTo) {
        where.loadingDate.lte = new Date(queryDto.dateTo);
      }
    }

    if (queryDto.search) {
      where.OR = [
        { name: { contains: queryDto.search, mode: 'insensitive' } },
        { notes: { contains: queryDto.search, mode: 'insensitive' } },
      ];
    }

    // Determine orderBy
    let orderBy: Prisma.PackingListOrderByWithRelationInput = {
      createdAt: 'desc',
    };
    if (sortBy) {
      const normalizedSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
      if (sortBy === 'loadingDate') {
        orderBy = { loadingDate: normalizedSortOrder };
      } else if (sortBy === 'name') {
        orderBy = { name: normalizedSortOrder };
      } else if (sortBy === 'createdAt') {
        orderBy = { createdAt: normalizedSortOrder };
      } else if (sortBy === 'updatedAt') {
        orderBy = { updatedAt: normalizedSortOrder };
      }
      // Add more sort fields if needed
    }

    const [data, total] = await Promise.all([
      this.prisma.packingList.findMany({
        where,
        skip,
        take: limit,
        include: {
          container: true,
          warehouse: true,
          packages: {
            select: {
              id: true,
              trackingCode: true,
              description: true,
              weight: true,
              cbm: true,
              customerId: true,
              customer: {
                select: {
                  customerCode: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy,
      }),
      this.prisma.packingList.count({ where }),
    ]);

    // Add package count to each packing list
    const dataWithPackageCount = data.map((packingList) => ({
      ...packingList,
      packageCount: packingList.packages.length,
    }));

    return {
      data: dataWithPackageCount,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<any> {
    const packingList = await this.prisma.packingList.findUnique({
      where: { id },
      include: {
        container: true,
        warehouse: true,
        packages: {
          include: {
            customer: true,
            photos: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        invoices: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!packingList) {
      throw new NotFoundException(`Packing list with ID ${id} not found`);
    }

    return packingList;
  }

  async findByName(name: string): Promise<any> {
    const packingList = await this.prisma.packingList.findUnique({
      where: { name },
      include: {
        container: true,
        warehouse: true,
        packages: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!packingList) {
      throw new NotFoundException(`Packing list with name '${name}' not found`);
    }

    return packingList;
  }

  async update(
    id: string,
    updatePackingListDto: UpdatePackingListDto,
    userId: string,
  ): Promise<any> {
    const existingPackingList = await this.findOne(id);

    const updateData: any = { ...updatePackingListDto };

    if (updatePackingListDto.loadingDate) {
      updateData.loadingDate = new Date(updatePackingListDto.loadingDate);
    }

    if (updatePackingListDto.eta) {
      updateData.eta = new Date(updatePackingListDto.eta);
    }

    // Check if name is unique (if being updated)
    if (
      updatePackingListDto.name &&
      updatePackingListDto.name !== existingPackingList.name
    ) {
      const nameExists = await this.prisma.packingList.findUnique({
        where: { name: updatePackingListDto.name },
      });

      if (nameExists) {
        throw new BadRequestException(
          `Packing list with name '${updatePackingListDto.name}' already exists`,
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPackingList = await tx.packingList.update({
        where: { id },
        data: updateData,
        include: {
          container: true,
          packages: {
            include: {
              customer: true,
            },
          },
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'PackingList',
          entityId: id,
          before: existingPackingList,
          after: updatedPackingList as any,
        },
      });

      return updatedPackingList;
    });

    this.logger.log(`Packing list '${result.name}' updated`);
    return result;
  }

  async addPackages(
    id: string,
    addPackagesDto: AddPackagesToPackingListDto,
    userId: string,
  ): Promise<any> {
    const { packageIds } = addPackagesDto;

    // Verify packing list exists
    await this.findOne(id);

    // Verify all packages exist and are available
    const packages = await this.prisma.package.findMany({
      where: {
        id: { in: packageIds },
      },
      include: {
        customer: true,
      },
    });

    if (packages.length !== packageIds.length) {
      throw new BadRequestException('Some packages not found');
    }

    // Check if any packages are already in another packing list
    const packagesInOtherLists = packages.filter(
      (pkg) => pkg.packingListId && pkg.packingListId !== id,
    );

    if (packagesInOtherLists.length > 0) {
      throw new BadRequestException(
        `Packages ${packagesInOtherLists
          .map((pkg) => pkg.trackingCode)
          .join(', ')} are already in other packing lists`,
      );
    }

    // Check package status - should be in warehouse or received
    const invalidStatusPackages = packages.filter(
      (pkg) => !['RECEIVED', 'IN_WAREHOUSE'].includes(pkg.status),
    );

    if (invalidStatusPackages.length > 0) {
      throw new BadRequestException(
        `Packages ${invalidStatusPackages
          .map((pkg) => pkg.trackingCode)
          .join(', ')} have invalid status for packing list assignment`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Update packages to belong to this packing list
      await tx.package.updateMany({
        where: { id: { in: packageIds } },
        data: {
          packingListId: id,
          status: PackageStatus.ASSIGNED,
        },
      });

      // Recalculate totals
      const updatedPackingList = await this.recalculateTotals(id, tx);

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'PackingList',
          entityId: id,
          metadata: {
            action: 'PACKAGES_ADDED',
            packageIds,
            packageCount: packageIds.length,
          },
        },
      });

      return updatedPackingList;
    });

    this.logger.log(
      `${packageIds.length} packages added to packing list '${result.name}'`,
    );
    return result;
  }

  async removePackages(
    id: string,
    packageIds: string[],
    userId: string,
  ): Promise<any> {
    // Verify packing list exists
    await this.findOne(id);

    // Verify packages belong to this packing list
    const packages = await this.prisma.package.findMany({
      where: {
        id: { in: packageIds },
        packingListId: id,
      },
    });

    if (packages.length !== packageIds.length) {
      throw new BadRequestException(
        'Some packages do not belong to this packing list',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Remove packages from packing list
      await tx.package.updateMany({
        where: { id: { in: packageIds } },
        data: {
          packingListId: null,
          status: PackageStatus.IN_WAREHOUSE,
        },
      });

      // Recalculate totals
      const updatedPackingList = await this.recalculateTotals(id, tx);

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'PackingList',
          entityId: id,
          metadata: {
            action: 'PACKAGES_REMOVED',
            packageIds,
            packageCount: packageIds.length,
          },
        },
      });

      return updatedPackingList;
    });

    this.logger.log(
      `${packageIds.length} packages removed from packing list '${result.name}'`,
    );
    return result;
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const existingPackingList = await this.findOne(id);

    // Check if there are invoices associated with this packing list
    const invoiceCount = await this.prisma.invoice.count({
      where: { packingListId: id },
    });

    if (invoiceCount > 0) {
      throw new BadRequestException(
        'Cannot delete packing list that has associated invoices',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Reset packages to warehouse status
      await tx.package.updateMany({
        where: { packingListId: id },
        data: {
          packingListId: null,
          status: PackageStatus.IN_WAREHOUSE,
        },
      });

      // Delete the packing list
      await tx.packingList.delete({
        where: { id },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELETE',
          entity: 'PackingList',
          entityId: id,
          before: existingPackingList,
        },
      });
    });

    this.logger.log(`Packing list '${existingPackingList.name}' deleted`);
    return { success: true };
  }

  async getPackingListSummary(id: string) {
    // Use findOne to ensure all relations are included
    const packingList = await this.findOne(id);

    // Group packages by customer
    const packagesByCustomer = packingList.packages.reduce((acc, pkg) => {
      const customerId = pkg.customerId;
      if (!acc[customerId]) {
        acc[customerId] = {
          customer: pkg.customer,
          packages: [],
          totalWeight: 0,
          totalCBM: 0,
          packageCount: 0,
        };
      }
      acc[customerId].packages.push(pkg);
      acc[customerId].totalWeight += pkg.weight || 0;
      acc[customerId].totalCBM += pkg.cbm || 0;
      acc[customerId].packageCount += 1;
      return acc;
    }, {});

    return {
      packingList: {
        id: packingList.id,
        name: packingList.name,
        loadingDate: packingList.loadingDate,
        totalPackages: packingList.totalPackages,
        totalWeight: packingList.totalWeight,
        totalCBM: packingList.totalCBM,
        container: packingList.container,
      },
      customerSummaries: Object.values(packagesByCustomer),
    };
  }

  private async recalculateTotals(
    packingListId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const prisma = tx || this.prisma;

    // Get all packages in this packing list
    const packages = await prisma.package.findMany({
      where: { packingListId },
    });

    const totalPackages = packages.length;
    const totalWeight = packages.reduce(
      (sum, pkg) => sum + (pkg.weight || 0),
      0,
    );
    const totalCBM = packages.reduce((sum, pkg) => sum + (pkg.cbm || 0), 0);

    // Update the packing list totals
    return prisma.packingList.update({
      where: { id: packingListId },
      data: {
        totalPackages,
        totalWeight,
        totalCBM,
      },
      include: {
        container: true,
        packages: {
          include: {
            customer: true,
          },
        },
      },
    });
  }

  private generateDefaultName(loadingDate: Date): string {
    const year = loadingDate.getFullYear();
    const month = (loadingDate.getMonth() + 1).toString().padStart(2, '0');
    const day = loadingDate.getDate().toString().padStart(2, '0');

    return `PL-${year}-${month}-${day}`;
  }

  // Export functionality - returns data formatted for PDF/Excel generation
  async getExportData(id: string) {
    const summary = await this.getPackingListSummary(id);

    return {
      packingList: summary.packingList,
      customerData: summary.customerSummaries,
      exportDate: new Date(),
      totalCustomers: summary.customerSummaries.length,
    };
  }

  // Finalize packing list and generate invoices
  async finalize(id: string, userId: string) {
    const packingList = await this.findOne(id);

    // Validation: Check if packing list can be finalized
    if (packingList.packages.length === 0) {
      throw new BadRequestException(
        'Cannot finalize packing list with no packages',
      );
    }

    if (!packingList.containerId) {
      throw new BadRequestException(
        'Packing list must be assigned to a container before finalization',
      );
    }

    // Check if already finalized
    if (packingList.invoices.length > 0) {
      throw new BadRequestException(
        'Packing list has already been finalized (invoices generated)',
      );
    }

    // Check if all packages are consolidated (use case requirement)
    const unconsolidatedPackages = packingList.packages.filter(
      (pkg) => !pkg.isConsolidated,
    );

    if (unconsolidatedPackages.length > 0) {
      throw new BadRequestException(
        `Packing list contains ${unconsolidatedPackages.length} unconsolidated package(s). All packages must be consolidated before finalization.`,
      );
    }

    // Generate invoices using the existing service
    const invoices = this.generateInvoicesForPackingList(id, userId);

    // Update packing list as finalized (no further edits allowed)
    const result = await this.prisma.$transaction(async (tx) => {
      const finalizedPackingList = await tx.packingList.update({
        where: { id },
        data: {
          status: 'FINALIZED',
          notes: packingList.notes
            ? `${packingList.notes}\nFINALIZED on ${new Date().toISOString()}`
            : `FINALIZED on ${new Date().toISOString()}`,
        },
        include: {
          container: true,
          packages: {
            include: {
              customer: true,
            },
          },
          invoices: {
            include: {
              customer: true,
            },
          },
        },
      });

      // Log the finalization action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'FINALIZE',
          entity: 'PackingList',
          entityId: id,
          before: packingList,
          after: finalizedPackingList as any,
          metadata: {
            invoiceCount: invoices.length,
            packageCount: packingList.packages.length,
          },
        },
      });

      return finalizedPackingList;
    });

    this.logger.log(
      `Packing list '${packingList.name}' finalized with ${invoices.length} invoices generated`,
    );

    return {
      packingList: result,
      invoices,
      message: `Packing list finalized successfully. ${invoices.length} invoice(s) generated.`,
    };
  }

  private generateInvoicesForPackingList(
    packingListId: string,
    userId: string,
  ) {
    // For now, return empty array until imports are fixed
    // TODO: Properly import and instantiate the InvoicesService
    return [];
  }
}
