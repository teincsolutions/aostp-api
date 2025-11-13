import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';
import { KpisInterface } from './interfaces/kpis.interface';
import { SeriesPointInterface } from './interfaces/series-point.interface';
import { PackagesByStatusInterface } from './interfaces/packages-by-status.interface';
import { InvoiceRowInterface } from './interfaces/invoice-row.interface';
import { AgingPackageRowInterface } from './interfaces/aging-package-row.interface';
import {
  Prisma,
  PackageStatus,
  ShippingMode,
  InvoiceStatus,
} from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis(filters?: DashboardFiltersDto): Promise<KpisInterface> {
    const whereClause: Prisma.PackageWhereInput =
      this.buildPackageWhereClause(filters);

    // Get package statistics
    const [
      customersTotal,
      packagesResult,
      shippingModeStats,
      activeContainers,
      outstandingInvoices,
    ] = await Promise.all([
      // Total customers
      this.prisma.customer.count(),

      // Total packages
      this.prisma.package.aggregate({
        where: whereClause,
        _count: { id: true },
      }),

      // Shipping mode breakdown
      this.prisma.package.groupBy({
        by: ['shippingMode'],
        where: whereClause,
        _count: { id: true },
      }),

      // Active containers (not closed)
      this.prisma.container.count({
        where: {
          status: {
            not: 'CLOSED',
          },
        },
      }),

      // Outstanding invoices (unpaid or partially paid)
      this.prisma.invoice.aggregate({
        where: {
          status: {
            in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID],
          },
          balance: {
            gt: 0,
          },
        },
        _count: { id: true },
        _sum: { balance: true },
      }),
    ]);

    // Calculate shipping mode totals
    const seaTotal =
      shippingModeStats.find((s) => s.shippingMode === ShippingMode.SEA)?._count
        .id || 0;
    const airTotal =
      shippingModeStats.find((s) => s.shippingMode === ShippingMode.AIR)?._count
        .id || 0;

    return {
      customersTotal,
      packagesTotal: packagesResult._count.id,
      seaTotal,
      airTotal,
      activeContainers,
      outstandingInvoicesCount: outstandingInvoices._count.id,
      outstandingInvoicesAmount: outstandingInvoices._sum.balance || 0,
    };
  }

  async getPackagesByStatus(
    filters?: DashboardFiltersDto,
  ): Promise<PackagesByStatusInterface[]> {
    const whereClause: Prisma.PackageWhereInput =
      this.buildPackageWhereClause(filters);

    const statusGroups = await this.prisma.package.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return statusGroups.map((group) => ({
      status: group.status,
      count: group._count.id,
    }));
  }

  async getPackagesByMonth(
    filters?: DashboardFiltersDto,
  ): Promise<SeriesPointInterface[]> {
    const whereClause: Prisma.PackageWhereInput =
      this.buildPackageWhereClause(filters);

    // Use raw SQL for monthly aggregation
    const monthlyData = await this.prisma.$queryRaw<
      Array<{ month: string; count: bigint }>
    >`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM') as month,
        COUNT(*) as count
      FROM "Package"
      WHERE ${whereClause ? Prisma.sql`TRUE` : Prisma.sql`TRUE`}
        ${filters?.dateFrom ? Prisma.sql`AND "createdAt" >= ${new Date(filters.dateFrom)}` : Prisma.empty}
        ${filters?.dateTo ? Prisma.sql`AND "createdAt" <= ${new Date(filters.dateTo)}` : Prisma.empty}
        ${filters?.status ? Prisma.sql`AND "status" = ${filters.status}` : Prisma.empty}
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY month
    `;

    return monthlyData.map((item) => ({
      x: item.month,
      y: Number(item.count),
    }));
  }

  async getRevenueTrend(
    filters?: DashboardFiltersDto,
  ): Promise<SeriesPointInterface[]> {
    // Aggregate payments by month for revenue trend
    const revenueData = await this.prisma.$queryRaw<
      Array<{ month: string; revenue: number }>
    >`
      SELECT
        TO_CHAR("processedAt", 'YYYY-MM') as month,
        SUM("localAmount") as revenue
      FROM "Payment"
      WHERE "gatewayStatus" = 'COMPLETED'
        ${filters?.dateFrom ? Prisma.sql`AND "processedAt" >= ${new Date(filters.dateFrom)}` : Prisma.empty}
        ${filters?.dateTo ? Prisma.sql`AND "processedAt" <= ${new Date(filters.dateTo)}` : Prisma.empty}
      GROUP BY TO_CHAR("processedAt", 'YYYY-MM')
      ORDER BY month
    `;

    return revenueData.map((item) => ({
      x: item.month,
      y: Number(item.revenue),
    }));
  }

  async getTopCustomers(
    filters?: DashboardFiltersDto,
  ): Promise<SeriesPointInterface[]> {
    // Get top customers by total payment amount
    const topCustomers = await this.prisma.$queryRaw<
      Array<{ customerName: string; totalRevenue: number }>
    >`
      SELECT
        CONCAT(c."firstName", ' ', c."lastName") as "customerName",
        SUM(p."localAmount") as "totalRevenue"
      FROM "Payment" p
      JOIN "Customer" c ON p."customerId" = c.id
      WHERE p."gatewayStatus" = 'COMPLETED'
        ${filters?.dateFrom ? Prisma.sql`AND p."processedAt" >= ${new Date(filters.dateFrom)}` : Prisma.empty}
        ${filters?.dateTo ? Prisma.sql`AND p."processedAt" <= ${new Date(filters.dateTo)}` : Prisma.empty}
      GROUP BY c.id, c."firstName", c."lastName"
      ORDER BY "totalRevenue" DESC
      LIMIT 10
    `;

    return topCustomers.map((customer) => ({
      x: customer.customerName,
      y: Number(customer.totalRevenue),
    }));
  }

  async getRecentInvoices(filters?: DashboardFiltersDto): Promise<{
    rows: InvoiceRowInterface[];
    total: number;
  }> {
    const whereClause: Prisma.InvoiceWhereInput = {};

    if (filters?.dateFrom || filters?.dateTo) {
      whereClause.createdAt = {};
      if (filters.dateFrom) {
        whereClause.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause.createdAt.lte = new Date(filters.dateTo);
      }
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: whereClause,
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10, // Limit to 10 recent invoices
      }),
      this.prisma.invoice.count({ where: whereClause }),
    ]);

    const rows: InvoiceRowInterface[] = invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customer: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
      total: invoice.totalAmount,
      paid: invoice.paidAmount,
      balance: invoice.balance,
      status: invoice.status,
      createdAt: invoice.createdAt.toISOString(),
    }));

    return {
      rows,
      total,
    };
  }

  async getAgingPackages(filters?: DashboardFiltersDto): Promise<{
    rows: AgingPackageRowInterface[];
    total: number;
  }> {
    const whereClause: Prisma.PackageWhereInput = {
      status: PackageStatus.RECEIVED,
      ...this.buildPackageWhereClause(filters),
    };

    // Get packages that have been in warehouse for more than 30 days
    const [packages, total] = await Promise.all([
      this.prisma.package.findMany({
        where: {
          ...whereClause,
          daysInWarehouse: {
            gte: 30, // Packages older than 30 days
          },
        },
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { daysInWarehouse: 'desc' },
        take: 10, // Limit to 10 aging packages
      }),
      this.prisma.package.count({
        where: {
          ...whereClause,
          daysInWarehouse: {
            gte: 30,
          },
        },
      }),
    ]);

    const rows: AgingPackageRowInterface[] = packages.map((pkg) => ({
      id: pkg.id,
      trackingNumber: pkg.trackingCode,
      customer: `${pkg.customer.firstName} ${pkg.customer.lastName}`,
      daysInWarehouse: pkg.daysInWarehouse,
      status: pkg.status,
      createdAt: pkg.createdAt.toISOString(),
    }));

    return {
      rows,
      total,
    };
  }

  private buildPackageWhereClause(
    filters?: DashboardFiltersDto,
  ): Prisma.PackageWhereInput {
    const where: Prisma.PackageWhereInput = {};

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo);
      }
    }

    if (filters?.status) {
      where.status = filters.status as PackageStatus;
    }

    return where;
  }
}
