import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ReportQueryDto } from './dto/common.dto';
import {
  PaymentsReportResponseDto,
  PaymentItemDto,
  PaymentTotalsDto,
  CurrencyTotalDto,
} from './dto/payments-report.dto';
import {
  PackingListReportResponseDto,
  PackingListItemDto,
  InvoiceStatsDto,
} from './dto/packing-list-report.dto';
import {
  CustomerLeagueReportResponseDto,
  CustomerRankingDto,
} from './dto/customer-league-report.dto';
import {
  ShippingMethodReportResponseDto,
  ShippingMethodStatsDto,
  TopCustomerByShippingDto,
} from './dto/shipping-method-report.dto';
import {
  GeneralReportResponseDto,
  GeneralCustomerDto,
} from './dto/general-report.dto';
import {
  PickupReportResponseDto,
  PickupItemDto,
} from './dto/pickup-report.dto';
import {
  WarehouseReportResponseDto,
  WarehouseStatsDto,
  WarehousePackingListDto,
} from './dto/warehouse-report.dto';
import { ShippingMode, InvoiceStatus, PackageStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build Prisma where clause from query filters
   */
  private buildWhereClause(query: ReportQueryDto) {
    const where: any = {};

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) {
        where.createdAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.createdAt.lte = new Date(query.toDate);
      }
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    return where;
  }

  /**
   * A. PAYMENTS REPORT
   * Returns list of all payments with totals by currency
   */
  async getPaymentsReport(
    query: ReportQueryDto,
  ): Promise<PaymentsReportResponseDto> {
    this.logger.log('Generating payments report');

    const where = this.buildWhereClause(query);

    // Add warehouse filter via customer relationship
    if (query.warehouseId) {
      where.customer = {
        warehouseId: query.warehouseId,
      };
    }

    // Fetch payments with related data
    const payments = await this.prisma.payment.findMany({
      where,
      select: {
        paymentCode: true,
        amount: true,
        localAmount: true,
        currency: true,
        paymentMethod: true,
        processedAt: true,
        customer: {
          select: {
            customerCode: true,
            firstName: true,
            lastName: true,
            warehouse: {
              select: {
                name: true,
              },
            },
          },
        },
        processedBy: {
          select: {
            email: true,
          },
        },
        exchangeRate: {
          select: {
            rate: true,
            toCurrency: true,
          },
        },
      },
      orderBy: {
        processedAt: 'desc',
      },
    });

    // Map to DTO
    const paymentItems: PaymentItemDto[] = payments.map((p) => ({
      paymentCode: p.paymentCode,
      customerCode: p.customer.customerCode,
      customerName: `${p.customer.firstName} ${p.customer.lastName}`,
      amount: p.amount,
      localAmount: p.localAmount,
      currency: p.currency,
      paymentMethod: p.paymentMethod,
      processedAt: p.processedAt,
      warehouse: p.customer.warehouse?.name || 'N/A',
      processedBy: p.processedBy.email,
    }));

    // Aggregate totals by currency
    const aggregates = await this.prisma.payment.groupBy({
      by: ['currency'],
      where,
      _sum: {
        amount: true,
        localAmount: true,
      },
    });

    const usdTotal =
      aggregates.find((a) => a.currency === 'USD')?._sum.amount || 0;
    const ghsTotal =
      aggregates.find((a) => a.currency === 'GHS')?._sum.localAmount || 0;

    const otherCurrencies: CurrencyTotalDto[] = aggregates
      .filter((a) => a.currency !== 'USD' && a.currency !== 'GHS')
      .map((a) => ({
        currency: a.currency,
        total: a._sum.amount || 0,
      }));

    const totals: PaymentTotalsDto = {
      usdTotal,
      ghsTotal,
      otherCurrencies,
    };

    return {
      payments: paymentItems,
      totals,
      totalCount: payments.length,
    };
  }

  /**
   * B. PACKING LIST REPORT
   * Returns stats about invoices in packing lists
   */
  async getPackingListReport(
    query: ReportQueryDto,
  ): Promise<PackingListReportResponseDto> {
    this.logger.log('Generating packing list report');

    const where: any = {};

    if (query.fromDate || query.toDate) {
      where.loadingDate = {};
      if (query.fromDate) {
        where.loadingDate.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.loadingDate.lte = new Date(query.toDate);
      }
    }

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    // Fetch packing lists with invoices
    const packingLists = await this.prisma.packingList.findMany({
      where,
      select: {
        id: true,
        name: true,
        totalPackages: true,
        totalCustomers: true,
        totalWeight: true,
        totalCBM: true,
        totalShippingCost: true,
        loadingDate: true,
        eta: true,
        container: {
          select: {
            containerNumber: true,
          },
        },
        invoices: {
          select: {
            status: true,
            totalAmount: true,
          },
        },
      },
      orderBy: {
        loadingDate: 'desc',
      },
    });

    // Aggregate overall stats
    let totalInvoices = 0;
    let paid = 0;
    let unpaid = 0;
    let partial = 0;
    let totalShippingCost = 0;
    let totalCBM = 0;
    let totalWeight = 0;

    const packingListItems: PackingListItemDto[] = packingLists.map((pl) => {
      const invoiceCount = pl.invoices.length;
      const paidCount = pl.invoices.filter(
        (inv) => inv.status === InvoiceStatus.PAID,
      ).length;
      const unpaidCount = pl.invoices.filter(
        (inv) => inv.status === InvoiceStatus.UNPAID,
      ).length;
      const partialCount = pl.invoices.filter(
        (inv) => inv.status === InvoiceStatus.PARTIALLY_PAID,
      ).length;

      totalInvoices += invoiceCount;
      paid += paidCount;
      unpaid += unpaidCount;
      partial += partialCount;
      totalShippingCost += pl.totalShippingCost;
      totalCBM += pl.totalCBM;
      totalWeight += pl.totalWeight;

      const invoiceStats: InvoiceStatsDto = {
        total: invoiceCount,
        paid: paidCount,
        unpaid: unpaidCount,
        partial: partialCount,
        paidPercentage: invoiceCount > 0 ? (paidCount / invoiceCount) * 100 : 0,
        unpaidPercentage:
          invoiceCount > 0 ? (unpaidCount / invoiceCount) * 100 : 0,
        partialPercentage:
          invoiceCount > 0 ? (partialCount / invoiceCount) * 100 : 0,
      };

      return {
        id: pl.id,
        name: pl.name,
        containerNumber: pl.container.containerNumber,
        totalPackages: pl.totalPackages,
        totalCustomers: pl.totalCustomers,
        totalWeight: pl.totalWeight,
        totalCBM: pl.totalCBM,
        totalShippingCost: pl.totalShippingCost,
        invoiceStats,
        loadingDate: pl.loadingDate,
        eta: pl.eta,
      };
    });

    return {
      totalInvoices,
      paid,
      unpaid,
      partial,
      paidPercentage: totalInvoices > 0 ? (paid / totalInvoices) * 100 : 0,
      unpaidPercentage: totalInvoices > 0 ? (unpaid / totalInvoices) * 100 : 0,
      partialPercentage:
        totalInvoices > 0 ? (partial / totalInvoices) * 100 : 0,
      totalShippingCost,
      totalCBM,
      totalWeight,
      packingLists: packingListItems,
    };
  }

  /**
   * C. CUSTOMER LEAGUE REPORT
   * Top customers by invoices, payments, CBM, weight
   */
  async getCustomerLeagueReport(
    query: ReportQueryDto,
  ): Promise<CustomerLeagueReportResponseDto> {
    this.logger.log('Generating customer league report');

    const where = this.buildWhereClause(query);

    // Top by invoices
    const topByInvoices = await this.prisma.invoice.groupBy({
      by: ['customerId'],
      where,
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          totalAmount: 'desc',
        },
      },
      take: 10,
    });

    const topInvoiceCustomers = await this.prisma.customer.findMany({
      where: {
        id: {
          in: topByInvoices.map((t) => t.customerId),
        },
      },
      select: {
        id: true,
        customerCode: true,
        firstName: true,
        lastName: true,
      },
    });

    const topByInvoicesDto: CustomerRankingDto[] = topByInvoices.map(
      (item, index) => {
        const customer = topInvoiceCustomers.find(
          (c) => c.id === item.customerId,
        );
        return {
          customerCode: customer?.customerCode || 'N/A',
          customerName: customer
            ? `${customer.firstName} ${customer.lastName}`
            : 'N/A',
          value: item._sum.totalAmount || 0,
          rank: index + 1,
        };
      },
    );

    // Top by payments
    const topByPayments = await this.prisma.payment.groupBy({
      by: ['customerId'],
      where,
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
      take: 10,
    });

    const topPaymentCustomers = await this.prisma.customer.findMany({
      where: {
        id: {
          in: topByPayments.map((t) => t.customerId),
        },
      },
      select: {
        id: true,
        customerCode: true,
        firstName: true,
        lastName: true,
      },
    });

    const topByPaymentsDto: CustomerRankingDto[] = topByPayments.map(
      (item, index) => {
        const customer = topPaymentCustomers.find(
          (c) => c.id === item.customerId,
        );
        return {
          customerCode: customer?.customerCode || 'N/A',
          customerName: customer
            ? `${customer.firstName} ${customer.lastName}`
            : 'N/A',
          value: item._sum.amount || 0,
          rank: index + 1,
        };
      },
    );

    // Top by CBM
    const packageWhere: any = {};
    if (query.fromDate || query.toDate) {
      packageWhere.createdAt = {};
      if (query.fromDate) {
        packageWhere.createdAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        packageWhere.createdAt.lte = new Date(query.toDate);
      }
    }

    const topByCbm = await this.prisma.package.groupBy({
      by: ['customerId'],
      where: packageWhere,
      _sum: {
        cbm: true,
      },
      orderBy: {
        _sum: {
          cbm: 'desc',
        },
      },
      take: 10,
    });

    const topCbmCustomers = await this.prisma.customer.findMany({
      where: {
        id: {
          in: topByCbm.map((t) => t.customerId),
        },
      },
      select: {
        id: true,
        customerCode: true,
        firstName: true,
        lastName: true,
      },
    });

    const topByCbmDto: CustomerRankingDto[] = topByCbm.map((item, index) => {
      const customer = topCbmCustomers.find((c) => c.id === item.customerId);
      return {
        customerCode: customer?.customerCode || 'N/A',
        customerName: customer
          ? `${customer.firstName} ${customer.lastName}`
          : 'N/A',
        value: item._sum.cbm || 0,
        rank: index + 1,
      };
    });

    // Top by weight
    const topByWeight = await this.prisma.package.groupBy({
      by: ['customerId'],
      where: packageWhere,
      _sum: {
        weight: true,
      },
      orderBy: {
        _sum: {
          weight: 'desc',
        },
      },
      take: 10,
    });

    const topWeightCustomers = await this.prisma.customer.findMany({
      where: {
        id: {
          in: topByWeight.map((t) => t.customerId),
        },
      },
      select: {
        id: true,
        customerCode: true,
        firstName: true,
        lastName: true,
      },
    });

    const topByWeightDto: CustomerRankingDto[] = topByWeight.map(
      (item, index) => {
        const customer = topWeightCustomers.find(
          (c) => c.id === item.customerId,
        );
        return {
          customerCode: customer?.customerCode || 'N/A',
          customerName: customer
            ? `${customer.firstName} ${customer.lastName}`
            : 'N/A',
          value: item._sum.weight || 0,
          rank: index + 1,
        };
      },
    );

    return {
      topByInvoices: topByInvoicesDto,
      topByPayments: topByPaymentsDto,
      topByCbm: topByCbmDto,
      topByWeight: topByWeightDto,
    };
  }

  /**
   * D. SHIPPING METHOD REPORT
   * Stats by shipping mode (SEA/AIR)
   */
  async getShippingMethodReport(
    query: ReportQueryDto,
  ): Promise<ShippingMethodReportResponseDto> {
    this.logger.log('Generating shipping method report');

    const shippingModes = [ShippingMode.SEA, ShippingMode.AIR];
    const results: ShippingMethodStatsDto[] = [];

    for (const mode of shippingModes) {
      const packageWhere: any = {
        shippingMode: mode,
      };

      if (query.fromDate || query.toDate) {
        packageWhere.createdAt = {};
        if (query.fromDate) {
          packageWhere.createdAt.gte = new Date(query.fromDate);
        }
        if (query.toDate) {
          packageWhere.createdAt.lte = new Date(query.toDate);
        }
      }

      if (query.warehouseId) {
        packageWhere.warehouseId = query.warehouseId;
      }

      // Get all packages for this mode
      const packages = await this.prisma.package.findMany({
        where: packageWhere,
        select: {
          id: true,
          customerId: true,
          invoice: {
            select: {
              totalAmount: true,
              status: true,
            },
          },
          customer: {
            select: {
              customerCode: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const revenue = packages.reduce(
        (sum, p) => sum + (p.invoice?.totalAmount || 0),
        0,
      );
      const invoiceCount = packages.filter((p) => p.invoice).length;
      const outstandingCount = packages.filter(
        (p) =>
          p.invoice &&
          (p.invoice.status === InvoiceStatus.UNPAID ||
            p.invoice.status === InvoiceStatus.PARTIALLY_PAID),
      ).length;

      const uniqueCustomers = new Set(packages.map((p) => p.customerId));
      const customerCount = uniqueCustomers.size;

      // Top customers for this mode
      const customerRevenue = new Map<string, number>();
      const customerInvoiceCount = new Map<string, number>();
      const customerDetails = new Map<string, { code: string; name: string }>();

      packages.forEach((p) => {
        if (p.invoice) {
          const current = customerRevenue.get(p.customerId) || 0;
          customerRevenue.set(p.customerId, current + p.invoice.totalAmount);

          const count = customerInvoiceCount.get(p.customerId) || 0;
          customerInvoiceCount.set(p.customerId, count + 1);

          customerDetails.set(p.customerId, {
            code: p.customer.customerCode,
            name: `${p.customer.firstName} ${p.customer.lastName}`,
          });
        }
      });

      const topCustomers: TopCustomerByShippingDto[] = Array.from(
        customerRevenue.entries(),
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([customerId, revenue]) => ({
          customerCode: customerDetails.get(customerId)?.code || 'N/A',
          customerName: customerDetails.get(customerId)?.name || 'N/A',
          revenue,
          invoiceCount: customerInvoiceCount.get(customerId) || 0,
        }));

      results.push({
        mode,
        revenue,
        invoiceCount,
        outstandingCount,
        customerCount,
        topCustomers,
      });
    }

    return {
      shippingMethods: results,
    };
  }

  /**
   * E. GENERAL REPORT
   * Comprehensive customer metrics including pickup rate
   */
  async getGeneralReport(
    query: ReportQueryDto,
  ): Promise<GeneralReportResponseDto> {
    this.logger.log('Generating general report');

    const where: any = {};

    if (query.customerId) {
      where.id = query.customerId;
    }

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    // Get all customers
    const customers = await this.prisma.customer.findMany({
      where,
      select: {
        id: true,
        customerCode: true,
        firstName: true,
        lastName: true,
        invoices: {
          where: {
            createdAt: query.fromDate
              ? { gte: new Date(query.fromDate) }
              : undefined,
          },
          select: {
            totalAmount: true,
            createdAt: true,
          },
        },
        payments: {
          where: {
            createdAt: query.fromDate
              ? { gte: new Date(query.fromDate) }
              : undefined,
          },
          select: {
            amount: true,
            createdAt: true,
          },
        },
        packages: {
          where: {
            createdAt: query.fromDate
              ? { gte: new Date(query.fromDate) }
              : undefined,
          },
          select: {
            shippingMode: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    const topCustomers: GeneralCustomerDto[] = customers
      .map((customer) => {
        const totalInvoices = customer.invoices.length;
        const totalInvoiceAmount = customer.invoices.reduce(
          (sum, inv) => sum + inv.totalAmount,
          0,
        );
        const totalPayments = customer.payments.length;
        const totalPaymentAmount = customer.payments.reduce(
          (sum, pay) => sum + pay.amount,
          0,
        );

        const totalPackages = customer.packages.length;
        const deliveredPackages = customer.packages.filter(
          (p) => p.status === PackageStatus.RELEASED,
        ).length;
        const pickupRate =
          totalPackages > 0 ? deliveredPackages / totalPackages : 0;

        const shippingModesUsed = Array.from(
          new Set(customer.packages.map((p) => p.shippingMode)),
        );

        const allDates = [
          ...customer.invoices.map((i) => i.createdAt),
          ...customer.payments.map((p) => p.createdAt),
          ...customer.packages.map((p) => p.createdAt),
        ];

        const firstDate = allDates.length
          ? new Date(Math.min(...allDates.map((d) => d.getTime())))
          : new Date();
        const lastDate = allDates.length
          ? new Date(Math.max(...allDates.map((d) => d.getTime())))
          : new Date();

        return {
          customerCode: customer.customerCode,
          customerName: `${customer.firstName} ${customer.lastName}`,
          totalInvoices,
          totalInvoiceAmount,
          totalPayments,
          totalPaymentAmount,
          pickupRate,
          shippingModesUsed,
          firstDate,
          lastDate,
        };
      })
      .sort((a, b) => b.totalInvoiceAmount - a.totalInvoiceAmount)
      .slice(0, 50);

    return {
      topCustomers,
      totalCustomers: customers.length,
    };
  }

  /**
   * F. PICKUP REPORT
   * Package delivery records
   */
  async getPickupReport(
    query: ReportQueryDto,
  ): Promise<PickupReportResponseDto> {
    this.logger.log('Generating pickup report');

    const where: any = {};

    if (query.fromDate || query.toDate) {
      where.releaseDate = {};
      if (query.fromDate) {
        where.releaseDate.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.releaseDate.lte = new Date(query.toDate);
      }
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    // Fetch deliveries
    const deliveries = await this.prisma.packageDelivery.findMany({
      where,
      select: {
        deliveryId: true,
        quantity: true,
        releaseDate: true,
        receiverName: true,
        notes: true,
        customer: {
          select: {
            customerCode: true,
            firstName: true,
            lastName: true,
            warehouse: {
              select: {
                name: true,
              },
            },
          },
        },
        invoice: {
          select: {
            invoiceNumber: true,
          },
        },
        package: {
          select: {
            pickupCode: true,
            trackingCode: true,
            description: true,
            status: true,
          },
        },
      },
      orderBy: {
        releaseDate: 'desc',
      },
    });

    const pickups: PickupItemDto[] = deliveries.map((d) => ({
      customerCode: d.customer.customerCode,
      customerName: `${d.customer.firstName} ${d.customer.lastName}`,
      invoiceNumber: d.invoice.invoiceNumber,
      pickupCode: d.package.pickupCode || 'N/A',
      pickupDate: d.releaseDate,
      quantity: d.quantity,
      warehouse: d.customer.warehouse?.name || 'N/A',
      status: d.package.status,
      trackingCode: d.package.trackingCode,
      description: d.package.description,
      deliveryId: d.deliveryId,
      receiverName: d.receiverName,
      notes: d.notes || '',
    }));

    return {
      pickups,
      totalCount: pickups.length,
    };
  }

  /**
   * G. WAREHOUSE REPORT
   * Stats by warehouse
   */
  async getWarehouseReport(
    query: ReportQueryDto,
  ): Promise<WarehouseReportResponseDto> {
    this.logger.log('Generating warehouse report');

    const where: any = {
      isActive: true,
    };

    if (query.warehouseId) {
      where.id = query.warehouseId;
    }

    const warehouses = await this.prisma.warehouse.findMany({
      where,
      select: {
        id: true,
        name: true,
        packages: {
          where: {
            createdAt: query.fromDate
              ? {
                  gte: new Date(query.fromDate),
                  ...(query.toDate && { lte: new Date(query.toDate) }),
                }
              : query.toDate
                ? { lte: new Date(query.toDate) }
                : undefined,
          },
          select: {
            id: true,
            customerId: true,
            weight: true,
            cbm: true,
            invoice: {
              select: {
                status: true,
                balance: true,
              },
            },
          },
        },
        packingLists: {
          where: {
            loadingDate: query.fromDate
              ? {
                  gte: new Date(query.fromDate),
                  ...(query.toDate && { lte: new Date(query.toDate) }),
                }
              : query.toDate
                ? { lte: new Date(query.toDate) }
                : undefined,
          },
          select: {
            id: true,
            name: true,
            totalPackages: true,
          },
        },
      },
    });

    let totalPackages = 0;
    let totalCustomers = 0;
    let totalWeight = 0;
    let totalCBM = 0;

    const warehouseStats: WarehouseStatsDto[] = warehouses.map((wh) => {
      const whPackageCount = wh.packages.length;
      const whCustomerCount = new Set(wh.packages.map((p) => p.customerId))
        .size;
      const whWeight = wh.packages.reduce((sum, p) => sum + (p.weight || 0), 0);
      const whCBM = wh.packages.reduce((sum, p) => sum + (p.cbm || 0), 0);

      const outstandingInvoices = wh.packages.filter(
        (p) =>
          p.invoice &&
          (p.invoice.status === InvoiceStatus.UNPAID ||
            p.invoice.status === InvoiceStatus.PARTIALLY_PAID),
      ).length;

      const outstandingAmount = wh.packages.reduce(
        (sum, p) => sum + (p.invoice?.balance || 0),
        0,
      );

      totalPackages += whPackageCount;
      totalCustomers += whCustomerCount;
      totalWeight += whWeight;
      totalCBM += whCBM;

      const packingLists: WarehousePackingListDto[] = wh.packingLists.map(
        (pl) => ({
          id: pl.id,
          name: pl.name,
          totalPackages: pl.totalPackages,
        }),
      );

      return {
        id: wh.id,
        name: wh.name,
        totalPackages: whPackageCount,
        totalCustomers: whCustomerCount,
        totalWeight: whWeight,
        totalCBM: whCBM,
        outstandingInvoices,
        outstandingAmount,
        packingLists,
      };
    });

    return {
      warehouses: warehouseStats,
      totalPackages,
      totalCustomers,
      totalWeight,
      totalCBM,
    };
  }
}
