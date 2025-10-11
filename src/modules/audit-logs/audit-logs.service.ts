import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';
import { AuditEntityType } from './audit-log.types';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(getAuditLogsDto: GetAuditLogsDto) {
    const {
      page = 1,
      limit = 20,
      userId,
      action,
      entity,
      entityId,
      ipAddress,
    } = getAuditLogsDto;
    let { sortBy, sortOrder } = getAuditLogsDto;

    // Default sort by timestamp
    if (!sortBy) {
      sortBy = 'timestamp';
    }
    if (!sortOrder) {
      sortOrder = 'desc';
    }

    const skip = (page - 1) * limit;

    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    if (entity) {
      where.entity = entity;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (ipAddress) {
      where.ipAddress = ipAddress;
    }

    const [rawData, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Transform data to match the AuditLog interface
    const data = rawData.map((log) => ({
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      actor: log.user
        ? {
            id: log.user.id,
            name: `${log.user.firstName} ${log.user.lastName}`,
            email: log.user.email,
            role: log.user.role,
          }
        : null,
      entityType: log.entity as AuditEntityType,
      entityId: log.entityId,
      action: log.action,
      before: log.before as Record<string, unknown> | null,
      after: log.after as Record<string, unknown> | null,
      metadata: log.metadata as Record<string, unknown> | undefined,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    if (!log) {
      return null;
    }

    // Transform to match the AuditLog interface
    return {
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      actor: log.user
        ? {
            id: log.user.id,
            name: `${log.user.firstName} ${log.user.lastName}`,
            email: log.user.email,
            role: log.user.role,
          }
        : null,
      entityType: log.entity as AuditEntityType,
      entityId: log.entityId,
      action: log.action,
      before: log.before as Record<string, unknown> | null,
      after: log.after as Record<string, unknown> | null,
      metadata: log.metadata as Record<string, unknown> | undefined,
    };
  }
}
