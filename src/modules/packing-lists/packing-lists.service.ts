import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreatePackingListDto } from './dto/create-packing-list.dto';
import { UpdatePackingListDto } from './dto/update-packing-list.dto';
import { AddPackagesToPackingListDto } from './dto/add-packages.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Prisma, PackingList, PackageStatus } from '@prisma/client';
import { IdGeneratorService } from '../../shared/utils/id-generator.service';

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
  ): Promise<PackingList> {
    const { containerId, loadingDate, name, notes } = createPackingListDto;

    // Verify container exists
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
    });

    if (!container) {
      throw new NotFoundException(`Container with ID ${containerId} not found`);
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

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      containerId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
  ) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.PackingListWhereInput = {};

    if (filters?.containerId) {
      where.containerId = filters.containerId;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.loadingDate = {};
      if (filters.dateFrom) {
        where.loadingDate.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.loadingDate.lte = new Date(filters.dateTo);
      }
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.packingList.findMany({
        where,
        skip,
        take: limit,
        include: {
          container: true,
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.packingList.count({ where }),
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

  async findOne(id: string): Promise<PackingList> {
    const packingList = await this.prisma.packingList.findUnique({
      where: { id },
      include: {
        container: true,
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

  async findByName(name: string): Promise<PackingList> {
    const packingList = await this.prisma.packingList.findUnique({
      where: { name },
      include: {
        container: true,
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
  ): Promise<PackingList> {
    const existingPackingList = await this.findOne(id);

    const updateData: any = { ...updatePackingListDto };

    if (updatePackingListDto.loadingDate) {
      updateData.loadingDate = new Date(updatePackingListDto.loadingDate);
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
          before: existingPackingList as any,
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
  ): Promise<PackingList> {
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
          status: PackageStatus.IN_PACKING_LIST,
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
  ): Promise<PackingList> {
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
          before: existingPackingList as any,
        },
      });
    });

    this.logger.log(`Packing list '${existingPackingList.name}' deleted`);
    return { success: true };
  }

  async getPackingListSummary(id: string) {
    const packingList = await this.prisma.packingList.findUnique({
      where: { id },
      include: {
        container: true,
        packages: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!packingList) {
      throw new NotFoundException(`Packing list with ID ${id} not found`);
    }

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
      acc[customerId].totalWeight += pkg.weight;
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
  ): Promise<PackingList> {
    const prisma = tx || this.prisma;

    // Get all packages in this packing list
    const packages = await prisma.package.findMany({
      where: { packingListId },
    });

    const totalPackages = packages.length;
    const totalWeight = packages.reduce((sum, pkg) => sum + pkg.weight, 0);
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
}
