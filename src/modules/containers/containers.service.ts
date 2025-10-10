import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Prisma, ContainerStatus } from '@prisma/client';

@Injectable()
export class ContainersService {
  private readonly logger = new Logger(ContainersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createContainerDto: CreateContainerDto, userId: string) {
    // Check if container number already exists
    const existingContainer = await this.prisma.container.findUnique({
      where: { containerNumber: createContainerDto.containerNumber },
    });

    if (existingContainer) {
      throw new BadRequestException(
        `Container with number ${createContainerDto.containerNumber} already exists`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const container = await tx.container.create({
        data: {
          ...createContainerDto,
          loadingDate: new Date(createContainerDto.loadingDate),
          eta: new Date(createContainerDto.eta),
        },
        include: {
          packingLists: true,
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entity: 'Container',
          entityId: container.id,
          after: container as any,
        },
      });

      return container;
    });

    this.logger.log(`Container created with number: ${result.containerNumber}`);
    return result;
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      status?: ContainerStatus;
      containerType?: any; // Import ContainerType when needed
      departureCity?: string;
      destinationCity?: string;
      search?: string;
    },
  ) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.ContainerWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.containerType) {
      where.containerType = filters.containerType;
    }

    if (filters?.departureCity) {
      where.departureCity = {
        contains: filters.departureCity,
        mode: 'insensitive',
      };
    }

    if (filters?.destinationCity) {
      where.destinationCity = {
        contains: filters.destinationCity,
        mode: 'insensitive',
      };
    }

    if (filters?.search) {
      where.OR = [
        {
          containerNumber: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          notes: { contains: filters.search, mode: 'insensitive' },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.container.findMany({
        where,
        skip,
        take: limit,
        include: {
          packingLists: {
            include: {
              _count: {
                select: { packages: true },
              },
            },
          },
        },
        orderBy: { loadingDate: 'desc' },
      }),
      this.prisma.container.count({ where }),
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
    const container = await this.prisma.container.findUnique({
      where: { id },
      include: {
        packingLists: {
          include: {
            packages: {
              include: {
                customer: true,
              },
            },
            invoices: true,
          },
        },
      },
    });

    if (!container) {
      throw new NotFoundException(`Container with ID ${id} not found`);
    }

    return container;
  }

  async findByContainerNumber(containerNumber: string) {
    const container = await this.prisma.container.findUnique({
      where: { containerNumber },
      include: {
        packingLists: {
          include: {
            packages: {
              include: {
                customer: true,
              },
            },
            invoices: true,
          },
        },
      },
    });

    if (!container) {
      throw new NotFoundException(
        `Container with number ${containerNumber} not found`,
      );
    }

    return container;
  }

  async update(
    id: string,
    updateContainerDto: UpdateContainerDto,
    userId: string,
  ) {
    const existingContainer = await this.findOne(id);

    const updateData: any = { ...updateContainerDto };

    if (updateContainerDto.loadingDate) {
      updateData.loadingDate = new Date(updateContainerDto.loadingDate);
    }

    if (updateContainerDto.eta) {
      updateData.eta = new Date(updateContainerDto.eta);
    }

    if (updateContainerDto.actualArrival) {
      updateData.actualArrival = new Date(updateContainerDto.actualArrival);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedContainer = await tx.container.update({
        where: { id },
        data: updateData,
        include: {
          packingLists: true,
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'Container',
          entityId: id,
          before: existingContainer as any,
          after: updatedContainer as any,
        },
      });

      return updatedContainer;
    });

    this.logger.log(
      `Container ${result.containerNumber} updated by user ${userId}`,
    );
    return result;
  }

  async updateStatus(id: string, status: ContainerStatus, userId: string) {
    const existingContainer = await this.findOne(id);

    // Validate status transition
    const validTransitions: Record<ContainerStatus, ContainerStatus[]> = {
      PLANNED: ['LOADED'],
      LOADED: ['SHIPPED'],
      SHIPPED: ['ARRIVED'],
      ARRIVED: ['CLOSED'],
      CLOSED: [],
    };

    const currentStatus = existingContainer.status;
    if (!validTransitions[currentStatus].includes(status)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${status}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedContainer = await tx.container.update({
        where: { id },
        data: {
          status,
          actualArrival:
            status === ContainerStatus.ARRIVED ? new Date() : undefined,
        },
        include: {
          packingLists: true,
        },
      });

      // Log the status change
      await tx.auditLog.create({
        data: {
          userId,
          action: 'STATUS_CHANGE',
          entity: 'Container',
          entityId: id,
          before: { status: existingContainer.status },
          after: { status },
          metadata: {
            oldStatus: existingContainer.status,
            newStatus: status,
          },
        },
      });

      return updatedContainer;
    });

    this.logger.log(
      `Container ${result.containerNumber} status changed from ${existingContainer.status} to ${status}`,
    );
    return result;
  }

  async remove(id: string, userId: string) {
    const existingContainer = await this.findOne(id);

    // Check if container can be deleted (no packing lists)
    if (existingContainer.packingLists.length > 0) {
      throw new BadRequestException(
        'Cannot delete container that has packing lists',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.container.delete({
        where: { id },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELETE',
          entity: 'Container',
          entityId: id,
          before: existingContainer as any,
        },
      });
    });

    this.logger.log(
      `Container ${existingContainer.containerNumber} deleted by user ${userId}`,
    );
    return { success: true };
  }

  async getActiveContainers() {
    return this.prisma.container.findMany({
      where: {
        status: {
          in: ['PLANNED', 'LOADED', 'SHIPPED'],
        },
      },
      include: {
        packingLists: {
          include: {
            _count: {
              select: { packages: true },
            },
          },
        },
      },
      orderBy: { eta: 'asc' },
    });
  }

  async getContainersByDateRange(startDate: Date, endDate: Date) {
    return this.prisma.container.findMany({
      where: {
        loadingDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        packingLists: {
          include: {
            _count: {
              select: { packages: true },
            },
          },
        },
      },
      orderBy: { loadingDate: 'asc' },
    });
  }

  async getContainerStatistics(id: string) {
    const container = await this.findOne(id);

    const stats = await this.prisma.packingList.aggregate({
      where: { containerId: id },
      _sum: {
        totalPackages: true,
        totalCBM: true,
        totalWeight: true,
      },
      _count: true,
    });

    return {
      container,
      statistics: {
        totalPackingLists: stats._count,
        totalPackages: stats._sum.totalPackages || 0,
        totalCBM: stats._sum.totalCBM || 0,
        totalWeight: stats._sum.totalWeight || 0,
      },
    };
  }
}
