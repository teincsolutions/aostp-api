import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';

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
      where.level = action; // action is the log level
    }

    if (entity) {
      where.method = entity; // entity is method
    }

    if (entityId) {
      where.url = entityId; // entityId is url
    }

    if (ipAddress) {
      where.ipAddress = ipAddress;
    }

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
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
      this.prisma.activityLog.count({ where }),
    ]);

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
    return await this.prisma.activityLog.findUnique({
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
  }
}
