import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class WarehousesService {
  private readonly logger = new Logger(WarehousesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createWarehouseDto: CreateWarehouseDto, userId: string) {
    // Check if name is unique
    const existingWarehouse = await this.prisma.warehouse.findFirst({
      where: { name: createWarehouseDto.name },
    });

    if (existingWarehouse) {
      throw new BadRequestException(
        `Warehouse with name "${createWarehouseDto.name}" already exists`,
      );
    }

    // Generate unique warehouseId (e.g., WH001, WH002)
    const lastWarehouse = await this.prisma.warehouse.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    const nextId = lastWarehouse
      ? parseInt(lastWarehouse.warehouseId.replace('WH', '')) + 1
      : 1;
    const warehouseId = `WH${nextId.toString().padStart(3, '0')}`;

    const warehouse = await this.prisma.warehouse.create({
      data: {
        warehouseId,
        ...createWarehouseDto,
      },
    });

    // Log creation
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        entity: 'Warehouse',
        entityId: warehouse.id,
        metadata: {
          warehouseId: warehouse.warehouseId,
          name: warehouse.name,
        },
      },
    });

    this.logger.log(`Warehouse "${warehouse.name}" created by user ${userId}`);
    return warehouse;
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      status?: 'active' | 'inactive' | 'all';
      search?: string;
    },
  ) {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.WarehouseWhereInput = {};

    if (filters?.status && filters.status !== 'all') {
      where.isActive = filters.status === 'active';
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
        { contactInfo: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.warehouse.count({ where }),
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
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    return warehouse;
  }

  async update(
    id: string,
    updateWarehouseDto: UpdateWarehouseDto,
    userId: string,
  ) {
    const existingWarehouse = await this.findOne(id);

    // Check name uniqueness if updating name
    if (
      updateWarehouseDto.name &&
      updateWarehouseDto.name !== existingWarehouse.name
    ) {
      const duplicate = await this.prisma.warehouse.findFirst({
        where: { name: updateWarehouseDto.name },
      });
      if (duplicate) {
        throw new BadRequestException(
          `Warehouse with name "${updateWarehouseDto.name}" already exists`,
        );
      }
    }

    const updatedWarehouse = await this.prisma.warehouse.update({
      where: { id },
      data: updateWarehouseDto,
    });

    // Log update
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'Warehouse',
        entityId: id,
        metadata: {
          warehouseId: existingWarehouse.warehouseId,
          name: updatedWarehouse.name,
          changedFields: Object.keys(updateWarehouseDto),
        },
      },
    });

    this.logger.log(
      `Warehouse "${updatedWarehouse.name}" updated by user ${userId}`,
    );
    return updatedWarehouse;
  }

  async remove(id: string, userId: string) {
    const warehouse = await this.findOne(id);

    // Check if warehouse has packages
    const packageCount = await this.prisma.packageItem.count({
      where: { warehouseId: id },
    });

    if (packageCount > 0) {
      throw new BadRequestException(
        `Cannot delete warehouse with ${packageCount} packages`,
      );
    }

    await this.prisma.warehouse.delete({
      where: { id },
    });

    // Log deletion
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE',
        entity: 'Warehouse',
        entityId: id,
        metadata: {
          warehouseId: warehouse.warehouseId,
          name: warehouse.name,
        },
      },
    });

    this.logger.log(`Warehouse "${warehouse.name}" deleted by user ${userId}`);
    return { success: true };
  }

  async toggleStatus(id: string, userId: string) {
    const warehouse = await this.findOne(id);

    const newStatus = !warehouse.isActive;

    const updatedWarehouse = await this.prisma.warehouse.update({
      where: { id },
      data: {
        isActive: newStatus,
      },
    });

    // If deactivating, ensure there are other active warehouses
    if (!newStatus) {
      const activeCount = await this.prisma.warehouse.count({
        where: { isActive: true },
      });

      if (activeCount === 0) {
        throw new BadRequestException(
          'Cannot deactivate the last active warehouse',
        );
      }
    }

    // Log status change
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'Warehouse',
        entityId: id,
        before: { isActive: warehouse.isActive },
        after: { isActive: newStatus },
        metadata: {
          action: 'WAREHOUSE_STATUS_CHANGED',
          oldStatus: warehouse.isActive ? 'active' : 'inactive',
          newStatus: newStatus ? 'active' : 'inactive',
        },
      },
    });

    this.logger.log(
      `Warehouse "${warehouse.name}" status changed to ${newStatus ? 'active' : 'inactive'}`,
    );
    return updatedWarehouse;
  }
}
