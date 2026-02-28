import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ReportQueryDto } from './dto/common.dto';
import {
  PaymentsReportResponseDto,
  PaymentItemDto,
  PaymentTotalsDto,
  CurrencyTotalDto,
  PaymentSourceTotalDto,
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
  PickupReportQueryDto,
} from './dto/pickup-report.dto';
import {
  WarehouseReportResponseDto,
  WarehouseStatsDto,
  WarehousePackingListDto,
  DestinationCityStatsDto,
} from './dto/warehouse-report.dto';
import {
  DebtorsReportResponseDto,
  DebtorItemDto,
  DebtorInvoiceDto,
  DebtorPackingListDto,
  DebtorsSummaryDto,
} from './dto/debtors-report.dto';
import {
  EodReportQueryDto,
  EodReportResponseDto,
  EodWarehouseBreakdownDto,
  EodWarehousePaymentsDto,
  EodWarehousePickupsDto,
  EodWarehouseIntakesDto,
  EodPaymentMethodDto,
  EodUserPickupDto,
  EodUserIntakeDto,
  EodUserActivityDto,
  EodOverallSummaryDto,
} from './dto/eod-report.dto';
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
        paymentSource: true, // CR-02
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
            firstName: true,
            lastName: true,
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
      customerName: `${p.customer.firstName}${p.customer.lastName ? ' ' + p.customer.lastName : ''}`,
      amount: p.amount,
      localAmount: p.localAmount,
      currency: p.currency,
      paymentMethod: p.paymentMethod,
      paymentSource: p.paymentSource, // CR-02
      processedAt: p.processedAt,
      warehouse: p.customer.warehouse?.name || 'N/A',
      processedBy: `${p.processedBy.firstName}${p.processedBy.lastName ? ' ' + p.processedBy.lastName : ''} <${p.processedBy.email}>`,
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

    // CR-02: Aggregate by payment source
    const sourceAggregates = await this.prisma.payment.groupBy({
      by: ['paymentSource'],
      where,
      _count: {
        id: true,
      },
      _sum: {
        amount: true,
        localAmount: true,
      },
    });

    const byPaymentSource = sourceAggregates.map((s) => ({
      paymentSource: s.paymentSource,
      count: s._count.id,
      totalAmount: s._sum.amount || 0,
      totalLocalAmount: s._sum.localAmount || 0,
    }));

    const totals: PaymentTotalsDto = {
      usdTotal,
      ghsTotal,
      otherCurrencies,
      byPaymentSource, // CR-02
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
            ? `${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}`
            : 'N/A',
          value: item._sum.totalAmount || 0,
          rank: index + 1,
        };
      },
    );

    // Top by payments (sum of amount + localAmount converted to USD)
    const payments = await this.prisma.payment.findMany({
      where,
      select: {
        customerId: true,
        amount: true,
        localAmount: true,
        currency: true,
        exchangeRate: {
          select: {
            rate: true,
          },
        },
      },
    });

    // Group by customer and calculate total in USD
    const customerPaymentTotals = new Map<
      string,
      { totalUsd: number; count: number }
    >();

    payments.forEach((payment) => {
      const existing = customerPaymentTotals.get(payment.customerId) || {
        totalUsd: 0,
        count: 0,
      };

      // Convert localAmount to USD using exchange rate
      let localAmountInUsd = 0;
      if (payment.localAmount && payment.exchangeRate?.rate) {
        localAmountInUsd = payment.localAmount / payment.exchangeRate.rate;
      }

      // Add amount (already in USD) + converted localAmount
      existing.totalUsd += (payment.amount || 0) + localAmountInUsd;
      existing.count += 1;

      customerPaymentTotals.set(payment.customerId, existing);
    });

    // Sort by total USD and take top 10
    const paymentTotals = Array.from(customerPaymentTotals.entries())
      .map(([customerId, data]) => ({
        customerId,
        totalValue: data.totalUsd,
        count: data.count,
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    const topPaymentCustomers = await this.prisma.customer.findMany({
      where: {
        id: {
          in: paymentTotals.map((t) => t.customerId),
        },
      },
      select: {
        id: true,
        customerCode: true,
        firstName: true,
        lastName: true,
      },
    });

    const topByPaymentsDto: CustomerRankingDto[] = paymentTotals.map(
      (item, index) => {
        const customer = topPaymentCustomers.find(
          (c) => c.id === item.customerId,
        );
        return {
          customerCode: customer?.customerCode || 'N/A',
          customerName: customer
            ? `${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}`
            : 'N/A',
          value: item.totalValue,
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

    // Filter out packages with null or zero CBM
    const cbmWhere = {
      ...packageWhere,
      cbm: {
        not: null,
        gt: 0,
      },
    };

    const topByCbm = await this.prisma.package.groupBy({
      by: ['customerId'],
      where: cbmWhere,
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
          ? `${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}`
          : 'N/A',
        value: item._sum.cbm || 0,
        rank: index + 1,
      };
    });

    // Top by weight
    const weightWhere = {
      ...packageWhere,
      weight: {
        not: null,
        gt: 0,
      },
    };

    const topByWeight = await this.prisma.package.groupBy({
      by: ['customerId'],
      where: weightWhere,
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
            ? `${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}`
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
            name: `${p.customer.firstName}${p.customer.lastName ? ' ' + p.customer.lastName : ''}`,
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
          customerName: `${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}`,
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
    query: PickupReportQueryDto,
  ): Promise<PickupReportResponseDto> {
    this.logger.log('Generating pickup report');

    const {
      page = 1,
      limit = 20,
      sortBy = 'releaseDate',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

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

    if (query.invoiceId) {
      where.invoiceId = query.invoiceId;
    }

    if (query.deliveryId) {
      where.deliveryId = {
        contains: query.deliveryId,
        mode: 'insensitive',
      };
    }

    if (query.receiverName) {
      where.receiverName = {
        contains: query.receiverName,
        mode: 'insensitive',
      };
    }

    if (query.trackingCode) {
      where.package = {
        trackingCode: {
          contains: query.trackingCode,
          mode: 'insensitive',
        },
      };
    }

    if (query.warehouseId) {
      where.package = {
        ...where.package,
        warehouseId: query.warehouseId,
      };
    }

    if (query.packingListId) {
      where.invoice = {
        packingListId: query.packingListId,
      };
    }

    // Fetch deliveries with pagination
    const [deliveries, total] = await Promise.all([
      this.prisma.packageDelivery.findMany({
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
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),
      this.prisma.packageDelivery.count({ where }),
    ]);

    const pickups: PickupItemDto[] = deliveries.map((d) => ({
      customerCode: d.customer.customerCode,
      customerName: `${d.customer.firstName}${d.customer.lastName ? ' ' + d.customer.lastName : ''}`,
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

    const totalPages = Math.ceil(total / limit);

    return {
      pickups,
      totalCount: total,
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
            quantity: true,
            weight: true,
            cbm: true,
            destinationCityId: true,
            destinationCity: {
              select: {
                id: true,
                name: true,
              },
            },
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

    // Track overall destination city totals across all warehouses
    const overallCityStats: Map<
      string | null,
      {
        cityId: string | null;
        cityName: string | null;
        totalWeight: number;
        totalCBM: number;
        totalAmount: number;
        totalPackages: number;
      }
    > = new Map();

    const warehouseStats: WarehouseStatsDto[] = warehouses.map((wh) => {
      const whPackageCount = wh.packages.reduce(
        (sum, p) => sum + (p.quantity || 0),
        0,
      );
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

      // Group packages by destination city within this warehouse
      const cityStatsMap: Map<
        string | null,
        {
          cityId: string | null;
          cityName: string | null;
          totalWeight: number;
          totalCBM: number;
          totalAmount: number;
          totalPackages: number;
        }
      > = new Map();

      for (const pkg of wh.packages) {
        const cityKey = pkg.destinationCityId || null;
        const cityName = pkg.destinationCity?.name || null;

        if (!cityStatsMap.has(cityKey)) {
          cityStatsMap.set(cityKey, {
            cityId: cityKey,
            cityName: cityName,
            totalWeight: 0,
            totalCBM: 0,
            totalAmount: 0,
            totalPackages: 0,
          });
        }

        const cityStat = cityStatsMap.get(cityKey)!;
        cityStat.totalWeight += pkg.weight || 0;
        cityStat.totalCBM += pkg.cbm || 0;
        cityStat.totalAmount += pkg.invoice?.balance || 0;
        cityStat.totalPackages += pkg.quantity || 0;

        // Aggregate to overall city stats
        if (!overallCityStats.has(cityKey)) {
          overallCityStats.set(cityKey, {
            cityId: cityKey,
            cityName: cityName,
            totalWeight: 0,
            totalCBM: 0,
            totalAmount: 0,
            totalPackages: 0,
          });
        }

        const overallCityStat = overallCityStats.get(cityKey)!;
        overallCityStat.totalWeight += pkg.weight || 0;
        overallCityStat.totalCBM += pkg.cbm || 0;
        overallCityStat.totalAmount += pkg.invoice?.balance || 0;
        overallCityStat.totalPackages += pkg.quantity || 0;
      }

      const destinationCities: DestinationCityStatsDto[] = Array.from(
        cityStatsMap.values(),
      ).sort((a, b) => b.totalPackages - a.totalPackages);

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
        destinationCities,
      };
    });

    // Convert overall city stats to array and sort by total packages
    const destinationCityTotals: DestinationCityStatsDto[] = Array.from(
      overallCityStats.values(),
    ).sort((a, b) => b.totalPackages - a.totalPackages);

    return {
      warehouses: warehouseStats,
      totalPackages,
      totalCustomers,
      totalWeight,
      totalCBM,
      destinationCityTotals,
    };
  }

  /**
   * DASHBOARD ENDPOINTS
   */

  private getMonthAbbreviation(month: number): string {
    const months = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];
    return months[month];
  }

  private buildDashboardWhere(query: any) {
    const year = query.year || new Date().getFullYear();
    const startDate = query.fromDate
      ? new Date(query.fromDate)
      : new Date(year, 0, 1);
    const endDate = query.toDate
      ? new Date(query.toDate)
      : new Date(year, 11, 31, 23, 59, 59);

    return {
      year,
      startDate,
      endDate,
      warehouseId: query.warehouseId,
      shippingMode: query.shippingMode,
    };
  }

  /**
   * H1. INVOICES BY MONTH GRAPH
   */
  async getInvoicesByMonth(query: any) {
    this.logger.log('Generating invoices by month graph');

    const { year, startDate, endDate, warehouseId } =
      this.buildDashboardWhere(query);

    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (warehouseId) {
      where.package = {
        warehouseId,
      };
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      select: {
        createdAt: true,
      },
    });

    // Group by month
    const monthCounts = new Array(12).fill(0);
    invoices.forEach((inv) => {
      const month = inv.createdAt.getMonth();
      monthCounts[month]++;
    });

    const series = monthCounts.map((count, index) => ({
      month: this.getMonthAbbreviation(index),
      count,
    }));

    return {
      year,
      series,
    };
  }

  /**
   * H2. PAYMENTS BY MONTH GRAPH (AIR vs SEA)
   */
  async getPaymentsByMonth(query: any) {
    this.logger.log('Generating payments by month graph');

    const { year, startDate, endDate, warehouseId } =
      this.buildDashboardWhere(query);

    const where: any = {
      processedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    const payments = await this.prisma.payment.findMany({
      where,
      select: {
        processedAt: true,
        localAmount: true,
        invoices: {
          select: {
            package: {
              select: {
                shippingMode: true,
                warehouseId: true,
              },
            },
          },
        },
      },
    });

    // Filter by warehouse if needed and group by month and shipping mode
    const monthlyData = new Array(12)
      .fill(null)
      .map(() => ({ air: 0, sea: 0 }));

    payments.forEach((payment) => {
      payment.invoices.forEach((invoice) => {
        if (invoice.package) {
          if (warehouseId && invoice.package.warehouseId !== warehouseId) {
            return;
          }

          const month = payment.processedAt.getMonth();
          if (invoice.package.shippingMode === ShippingMode.AIR) {
            monthlyData[month].air += payment.localAmount;
          } else if (invoice.package.shippingMode === ShippingMode.SEA) {
            monthlyData[month].sea += payment.localAmount;
          }
        }
      });
    });

    const series = monthlyData.map((data, index) => ({
      month: this.getMonthAbbreviation(index),
      air: Math.round(data.air * 100) / 100,
      sea: Math.round(data.sea * 100) / 100,
    }));

    return {
      year,
      series,
    };
  }

  /**
   * H3. INTAKES BY MONTH GRAPH
   */
  async getIntakesByMonth(query: any) {
    this.logger.log('Generating intakes by month graph');

    const { year, startDate, endDate, warehouseId } =
      this.buildDashboardWhere(query);

    const where: any = {
      receivedDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const intakes = await this.prisma.package.findMany({
      where,
      select: {
        receivedDate: true,
      },
    });

    // Group by month
    const monthCounts = new Array(12).fill(0);
    intakes.forEach((intake) => {
      const month = intake.receivedDate.getMonth();
      monthCounts[month]++;
    });

    const series = monthCounts.map((count, index) => ({
      month: this.getMonthAbbreviation(index),
      count,
    }));

    return {
      year,
      series,
    };
  }

  /**
   * H4. PICKUPS BY MONTH GRAPH
   */
  async getPickupsByMonth(query: any) {
    this.logger.log('Generating pickups by month graph');

    const { year, startDate, endDate } = this.buildDashboardWhere(query);

    const where: any = {
      releaseDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    const pickups = await this.prisma.packageDelivery.findMany({
      where,
      select: {
        releaseDate: true,
      },
    });

    // Group by month
    const monthCounts = new Array(12).fill(0);
    pickups.forEach((pickup) => {
      const month = pickup.releaseDate.getMonth();
      monthCounts[month]++;
    });

    const series = monthCounts.map((count, index) => ({
      month: this.getMonthAbbreviation(index),
      count,
    }));

    return {
      year,
      series,
    };
  }

  /**
   * H5. PAYMENT METHOD BREAKDOWN GRAPH
   */
  async getPaymentMethods(query: any) {
    this.logger.log('Generating payment methods breakdown');

    const { startDate, endDate, warehouseId } = this.buildDashboardWhere(query);

    const where: any = {
      processedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (warehouseId) {
      where.customer = {
        warehouseId,
      };
    }

    const payments = await this.prisma.payment.groupBy({
      by: ['paymentMethod'],
      where,
      _sum: {
        localAmount: true,
      },
    });

    const methods = payments.map((p) => ({
      method: p.paymentMethod,
      amount: Math.round((p._sum.localAmount || 0) * 100) / 100,
    }));

    const total = methods.reduce((sum, m) => sum + m.amount, 0);

    return {
      total: Math.round(total * 100) / 100,
      methods,
    };
  }

  /**
   * H6. SHIPPING MODE SUMMARY GRAPH
   */
  async getShippingModes(query: any) {
    this.logger.log('Generating shipping modes summary');

    const { startDate, endDate, warehouseId } = this.buildDashboardWhere(query);

    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const counts = await this.prisma.package.groupBy({
      by: ['shippingMode'],
      where,
      _count: {
        id: true,
      },
    });

    const air =
      counts.find((c) => c.shippingMode === ShippingMode.AIR)?._count.id || 0;
    const sea =
      counts.find((c) => c.shippingMode === ShippingMode.SEA)?._count.id || 0;

    return {
      air,
      sea,
    };
  }

  /**
   * H7. TOP 10 CUSTOMERS BY AMOUNT
   */
  async getTopCustomersByAmount(query: any) {
    this.logger.log('Generating top customers by amount');

    const { year, startDate, endDate, warehouseId } =
      this.buildDashboardWhere(query);

    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (warehouseId) {
      where.customer = {
        warehouseId,
      };
    }

    const topCustomers = await this.prisma.invoice.groupBy({
      by: ['customerId'],
      where,
      _sum: {
        totalAmount: true,
        paidAmount: true,
        balance: true,
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

    const customerIds = topCustomers.map((c) => c.customerId);
    const customers = await this.prisma.customer.findMany({
      where: {
        id: {
          in: customerIds,
        },
      },
      select: {
        id: true,
        customerCode: true,
        firstName: true,
        lastName: true,
      },
    });

    const top = topCustomers.map((item) => {
      const customer = customers.find((c) => c.id === item.customerId);
      return {
        customerCode: customer?.customerCode || 'N/A',
        customerName: customer
          ? `${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}`
          : 'N/A',
        totalAmount: Math.round((item._sum.totalAmount || 0) * 100) / 100,
        totalPaid: Math.round((item._sum.paidAmount || 0) * 100) / 100,
        balance: Math.round((item._sum.balance || 0) * 100) / 100,
        invoiceCount: item._count.id,
      };
    });

    return {
      year,
      top,
    };
  }

  /**
   * H8. TOP 10 CUSTOMERS BY SHIPPING (CBM - Combined AIR & SEA)
   */
  async getTopCustomersShipping(query: any) {
    this.logger.log('Generating top customers by shipping (combined CBM)');

    const { year, startDate, endDate, warehouseId } =
      this.buildDashboardWhere(query);

    const packageWhere: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (warehouseId) {
      packageWhere.warehouseId = warehouseId;
    }

    // Get top 10 customers by total CBM (AIR + SEA combined)
    const topCustomersData = await this.prisma.package.groupBy({
      by: ['customerId'],
      where: packageWhere,
      _sum: {
        cbm: true,
        weight: true,
      },
      orderBy: {
        _sum: {
          cbm: 'desc',
        },
      },
      take: 10,
    });

    const customerIds = topCustomersData.map((c) => c.customerId);

    // Get customer details
    const customers = await this.prisma.customer.findMany({
      where: {
        id: {
          in: customerIds,
        },
      },
      select: {
        id: true,
        customerCode: true,
        firstName: true,
        lastName: true,
      },
    });

    // Get invoice totals for these customers
    const invoiceWhere: any = {
      customerId: {
        in: customerIds,
      },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (warehouseId) {
      invoiceWhere.package = {
        warehouseId,
      };
    }

    const invoiceTotals = await this.prisma.invoice.groupBy({
      by: ['customerId'],
      where: invoiceWhere,
      _sum: {
        totalAmount: true,
        paidAmount: true,
      },
    });

    // Combine all data
    const topCustomers = topCustomersData.map((item, index) => {
      const customer = customers.find((c) => c.id === item.customerId);
      const invoiceData = invoiceTotals.find(
        (inv) => inv.customerId === item.customerId,
      );

      return {
        rank: index + 1,
        customerCode: customer?.customerCode || 'N/A',
        customerName: customer
          ? `${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}`
          : 'N/A',
        totalCBM: Math.round((item._sum.cbm || 0) * 100) / 100,
        totalWeight: Math.round((item._sum.weight || 0) * 100) / 100,
        totalInvoiceAmount:
          Math.round((invoiceData?._sum.totalAmount || 0) * 100) / 100,
        totalPaid: Math.round((invoiceData?._sum.paidAmount || 0) * 100) / 100,
      };
    });

    return {
      year,
      topCustomers,
    };
  }

  /**
   * H9. RECENT INTAKES
   */
  async getRecentIntakes(query: any) {
    this.logger.log('Fetching recent intakes');

    const limit = Math.min(Number(query.limit) || 20, 100);
    const where: any = {};

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.fromDate || query.toDate) {
      where.receivedDate = {};
      if (query.fromDate) {
        where.receivedDate.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.receivedDate.lte = new Date(query.toDate);
      }
    }

    if (query.cursor) {
      where.id = {
        lt: query.cursor,
      };
    }

    const items = await this.prisma.package.findMany({
      where,
      select: {
        id: true,
        trackingCode: true,
        description: true,
        quantity: true,
        weight: true,
        cbm: true,
        receivedDate: true,
        customer: {
          select: {
            customerCode: true,
            firstName: true,
            lastName: true,
          },
        },
        warehouse: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        receivedDate: 'desc',
      },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? resultItems[resultItems.length - 1].id : null;

    const mappedItems = resultItems.map((item) => ({
      id: item.id,
      intakeTrackingCode: item.trackingCode,
      customerCode: item.customer.customerCode,
      customerName: `${item.customer.firstName}${item.customer.lastName ? ' ' + item.customer.lastName : ''}`,
      description: item.description,
      quantity: item.quantity,
      weight: item.weight,
      cbm: item.cbm,
      receivedDate: item.receivedDate,
      warehouse: item.warehouse?.name,
    }));

    return {
      items: mappedItems,
      total: resultItems.length,
      nextCursor,
    };
  }

  /**
   * H9. RECENT INVOICES VS PAYMENTS
   */
  async getRecentInvoicesPayments(query: any) {
    this.logger.log('Fetching recent invoices vs payments');

    const limit = Math.min(Number(query.limit) || 20, 100);
    const where: any = {};

    if (query.warehouseId) {
      where.customer = {
        warehouseId: query.warehouseId,
      };
    }

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) {
        where.createdAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.createdAt.lte = new Date(query.toDate);
      }
    }

    if (query.cursor) {
      where.id = {
        lt: query.cursor,
      };
    }

    const items = await this.prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        paidAmount: true,
        balance: true,
        status: true,
        createdAt: true,
        dueDate: true,
        customer: {
          select: {
            customerCode: true,
            firstName: true,
            lastName: true,
          },
        },
        payments: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? resultItems[resultItems.length - 1].id : null;

    const mappedItems = resultItems.map((item) => ({
      id: item.id,
      invoiceNumber: item.invoiceNumber,
      customerCode: item.customer.customerCode,
      customerName: `${item.customer.firstName}${item.customer.lastName ? ' ' + item.customer.lastName : ''}`,
      totalAmount: item.totalAmount,
      paidAmount: item.paidAmount,
      balance: item.balance,
      status: item.status,
      paymentCount: item.payments.length,
      createdAt: item.createdAt,
      dueDate: item.dueDate,
    }));

    return {
      items: mappedItems,
      total: resultItems.length,
      nextCursor,
    };
  }

  /**
   * H9. RECENT AGED PACKAGES
   */
  async getRecentAgedPackages(query: any) {
    this.logger.log('Fetching recent aged packages');

    const limit = Math.min(Number(query.limit) || 20, 100);
    const minDays = query.minDays ? Number(query.minDays) : 0;

    const where: any = {
      status: {
        not: PackageStatus.RELEASED,
      },
    };

    // Filter by minimum days in warehouse
    if (minDays > 0) {
      where.daysInWarehouse = {
        gte: minDays,
      };
    }

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.fromDate || query.toDate) {
      where.receivedDate = {};
      if (query.fromDate) {
        where.receivedDate.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.receivedDate.lte = new Date(query.toDate);
      }
    }

    if (query.cursor) {
      where.id = {
        lt: query.cursor,
      };
    }

    const items = await this.prisma.package.findMany({
      where,
      select: {
        id: true,
        trackingCode: true,
        description: true,
        status: true,
        daysInWarehouse: true,
        receivedDate: true,
        customer: {
          select: {
            customerCode: true,
            firstName: true,
            lastName: true,
          },
        },
        warehouse: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        daysInWarehouse: 'desc',
      },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? resultItems[resultItems.length - 1].id : null;

    const mappedItems = resultItems.map((item) => ({
      id: item.id,
      trackingCode: item.trackingCode,
      customerCode: item.customer.customerCode,
      customerName: `${item.customer.firstName}${item.customer.lastName ? ' ' + item.customer.lastName : ''}`,
      description: item.description,
      status: item.status,
      daysInWarehouse: item.daysInWarehouse,
      receivedDate: item.receivedDate,
      warehouse: item.warehouse?.name || 'N/A',
    }));

    return {
      items: mappedItems,
      total: resultItems.length,
      nextCursor,
    };
  }

  /**
   * H9. RECENT PACKING LISTS
   */
  async getRecentPackingLists(query: any) {
    this.logger.log('Fetching recent packing lists');

    const limit = Math.min(Number(query.limit) || 20, 100);
    const where: any = {};

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.fromDate || query.toDate) {
      where.loadingDate = {};
      if (query.fromDate) {
        where.loadingDate.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.loadingDate.lte = new Date(query.toDate);
      }
    }

    if (query.cursor) {
      where.id = {
        lt: query.cursor,
      };
    }

    const items = await this.prisma.packingList.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        totalPackages: true,
        totalCustomers: true,
        totalCBM: true,
        totalWeight: true,
        loadingDate: true,
        eta: true,
        container: {
          select: {
            containerNumber: true,
          },
        },
        warehouse: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        loadingDate: 'desc',
      },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? resultItems[resultItems.length - 1].id : null;

    const mappedItems = resultItems.map((item) => ({
      id: item.id,
      name: item.name,
      containerNumber: item.container.containerNumber,
      status: item.status,
      totalPackages: item.totalPackages,
      totalCustomers: item.totalCustomers,
      totalCBM: item.totalCBM,
      totalWeight: item.totalWeight,
      loadingDate: item.loadingDate,
      eta: item.eta,
      warehouse: item.warehouse?.name || 'N/A',
    }));

    return {
      items: mappedItems,
      total: resultItems.length,
      nextCursor,
    };
  }

  /**
   * H9. RECENT PICKUPS
   */
  async getRecentPickups(query: any) {
    this.logger.log('Fetching recent pickups');

    const limit = Math.min(Number(query.limit) || 20, 100);
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

    if (query.cursor) {
      where.id = {
        lt: query.cursor,
      };
    }

    const items = await this.prisma.packageDelivery.findMany({
      where,
      select: {
        deliveryId: true,
        quantity: true,
        receiverName: true,
        releaseDate: true,
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
            trackingCode: true,
            pickupCode: true,
          },
        },
      },
      orderBy: {
        releaseDate: 'desc',
      },
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore
      ? resultItems[resultItems.length - 1].deliveryId
      : null;

    const mappedItems = resultItems.map((item) => ({
      deliveryId: item.deliveryId,
      customerCode: item.customer.customerCode,
      customerName: `${item.customer.firstName}${item.customer.lastName ? ' ' + item.customer.lastName : ''}`,
      invoiceNumber: item.invoice.invoiceNumber,
      trackingCode: item.package.trackingCode,
      pickupCode: item.package.pickupCode,
      quantity: item.quantity,
      receiverName: item.receiverName,
      releaseDate: item.releaseDate,
      warehouse: item.customer.warehouse?.name || 'N/A',
    }));

    return {
      items: mappedItems,
      total: resultItems.length,
      nextCursor,
    };
  }

  /**
   * I. DEBTORS LIST REPORT
   * Customers with outstanding balances, sorted by highest outstanding amount.
   * Includes packing list breakdown and invoice count per debtor.
   */
  async getDebtorsReport(
    query: ReportQueryDto,
  ): Promise<DebtorsReportResponseDto> {
    this.logger.log('Generating debtors list report');

    const invoiceWhere: any = {
      status: {
        in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID],
      },
      balance: {
        gt: 0,
      },
    };

    if (query.fromDate || query.toDate) {
      invoiceWhere.createdAt = {};
      if (query.fromDate) {
        invoiceWhere.createdAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        invoiceWhere.createdAt.lte = new Date(query.toDate);
      }
    }

    if (query.customerId) {
      invoiceWhere.customerId = query.customerId;
    }

    if (query.warehouseId) {
      invoiceWhere.customer = { warehouseId: query.warehouseId };
    }

    // Fetch all outstanding invoices with related customer and packing list data
    const invoices = await this.prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        paidAmount: true,
        balance: true,
        currency: true,
        dueDate: true,
        createdAt: true,
        customerId: true,
        packingListId: true,
        packingList: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            customerCode: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
            warehouse: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        balance: 'desc',
      },
    });

    // Group invoices by customer
    const customerMap = new Map<
      string,
      {
        customer: (typeof invoices)[0]['customer'];
        invoiceList: typeof invoices;
      }
    >();

    invoices.forEach((invoice) => {
      const existing = customerMap.get(invoice.customerId);
      if (existing) {
        existing.invoiceList.push(invoice);
      } else {
        customerMap.set(invoice.customerId, {
          customer: invoice.customer,
          invoiceList: [invoice],
        });
      }
    });

    // Build debtors list, then sort by outstanding balance descending
    const debtors: DebtorItemDto[] = Array.from(customerMap.values())
      .map(({ customer, invoiceList }) => {
        const totalInvoiceAmount = invoiceList.reduce(
          (sum, inv) => sum + inv.totalAmount,
          0,
        );
        const totalPaidAmount = invoiceList.reduce(
          (sum, inv) => sum + inv.paidAmount,
          0,
        );
        const outstandingBalance = invoiceList.reduce(
          (sum, inv) => sum + inv.balance,
          0,
        );

        // Aggregate packing list breakdown
        const packingListMap = new Map<
          string,
          {
            id: string;
            name: string;
            invoiceCount: number;
            outstandingBalance: number;
          }
        >();

        invoiceList.forEach((inv) => {
          if (inv.packingListId && inv.packingList) {
            const existing = packingListMap.get(inv.packingListId);
            if (existing) {
              existing.invoiceCount++;
              existing.outstandingBalance += inv.balance;
            } else {
              packingListMap.set(inv.packingListId, {
                id: inv.packingList.id,
                name: inv.packingList.name,
                invoiceCount: 1,
                outstandingBalance: inv.balance,
              });
            }
          }
        });

        const packingLists: DebtorPackingListDto[] = Array.from(
          packingListMap.values(),
        ).map((pl) => ({
          ...pl,
          outstandingBalance: Math.round(pl.outstandingBalance * 100) / 100,
        }));

        const lastInvoiceDate = invoiceList.reduce(
          (latest, inv) =>
            inv.createdAt > latest ? inv.createdAt : latest,
          invoiceList[0].createdAt,
        );

        const invoiceDtos: DebtorInvoiceDto[] = invoiceList.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          totalAmount: inv.totalAmount,
          paidAmount: inv.paidAmount,
          balance: Math.round(inv.balance * 100) / 100,
          currency: inv.currency,
          dueDate: inv.dueDate,
          createdAt: inv.createdAt,
          packingListName: inv.packingList?.name,
          packingListId: inv.packingListId ?? undefined,
        }));

        return {
          customerCode: customer.customerCode,
          customerName: `${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}`,
          phoneNumber: customer.phoneNumber,
          email: customer.email ?? undefined,
          warehouse: customer.warehouse?.name || 'N/A',
          totalInvoiceAmount: Math.round(totalInvoiceAmount * 100) / 100,
          totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
          outstandingBalance: Math.round(outstandingBalance * 100) / 100,
          invoiceCount: invoiceList.length,
          packingListCount: packingListMap.size,
          packingLists,
          invoices: invoiceDtos,
          lastInvoiceDate,
          rank: 0,
        };
      })
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
      .map((debtor, index) => ({ ...debtor, rank: index + 1 }));

    // Compute summary
    const totalOutstanding = debtors.reduce(
      (sum, d) => sum + d.outstandingBalance,
      0,
    );
    const totalInvoiceAmount = debtors.reduce(
      (sum, d) => sum + d.totalInvoiceAmount,
      0,
    );
    const totalPaidAmount = debtors.reduce(
      (sum, d) => sum + d.totalPaidAmount,
      0,
    );
    const collectionRate =
      totalInvoiceAmount > 0
        ? (totalPaidAmount / totalInvoiceAmount) * 100
        : 0;

    const summary: DebtorsSummaryDto = {
      totalDebtors: debtors.length,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalInvoiceAmount: Math.round(totalInvoiceAmount * 100) / 100,
      totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
      collectionRate: Math.round(collectionRate * 100) / 100,
    };

    return {
      debtors,
      summary,
      totalCount: debtors.length,
    };
  }

  /**
   * J. END OF DAY REPORT
   * Total payments (GHS/USD, by method) per warehouse, total pickups per warehouse,
   * and a summary of all day activities filterable by user and warehouse.
   */
  async getEndOfDayReport(
    query: EodReportQueryDto,
  ): Promise<EodReportResponseDto> {
    this.logger.log('Generating end-of-day report');

    // ── Date range ──────────────────────────────────────────────────────────
    const dateStr =
      query.date || new Date().toISOString().split('T')[0];
    const fromDate = query.fromDate
      ? new Date(query.fromDate)
      : new Date(`${dateStr}T00:00:00.000Z`);
    const toDate = query.toDate
      ? new Date(query.toDate)
      : new Date(`${dateStr}T23:59:59.999Z`);

    // ── Build optional filters ───────────────────────────────────────────────
    const customerWarehouseFilter = query.warehouseId
      ? { customer: { warehouseId: query.warehouseId } }
      : {};
    const directWarehouseFilter = query.warehouseId
      ? { warehouseId: query.warehouseId }
      : {};
    const paymentUserFilter = query.userId
      ? { processedById: query.userId }
      : {};
    const packageUserFilter = query.userId
      ? { createdById: query.userId }
      : {};
    const deliveryUserFilter = query.userId
      ? { createdById: query.userId }
      : {};

    // ── Parallel data fetch ──────────────────────────────────────────────────
    const [payments, deliveries, packages, invoices] = await Promise.all([
      // Payments processed today
      this.prisma.payment.findMany({
        where: {
          processedAt: { gte: fromDate, lte: toDate },
          ...paymentUserFilter,
          ...customerWarehouseFilter,
        },
        select: {
          amount: true,
          localAmount: true,
          currency: true,
          paymentMethod: true,
          processedById: true,
          processedBy: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
              warehouse: { select: { name: true } },
            },
          },
          customer: {
            select: {
              warehouseId: true,
              warehouse: { select: { id: true, name: true } },
            },
          },
        },
      }),

      // Pickups / deliveries released today
      this.prisma.packageDelivery.findMany({
        where: {
          releaseDate: { gte: fromDate, lte: toDate },
          ...deliveryUserFilter,
          ...directWarehouseFilter,
        },
        select: {
          warehouseId: true,
          quantity: true,
          createdById: true,
          createdBy: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
              warehouse: { select: { name: true } },
            },
          },
        },
      }),

      // Package intakes received today
      this.prisma.package.findMany({
        where: {
          receivedDate: { gte: fromDate, lte: toDate },
          ...packageUserFilter,
          ...directWarehouseFilter,
        },
        select: {
          warehouseId: true,
          quantity: true,
          createdById: true,
          createdBy: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
              warehouse: { select: { name: true } },
            },
          },
        },
      }),

      // Invoices created today (overall only; no createBy on Invoice)
      this.prisma.invoice.aggregate({
        where: {
          createdAt: { gte: fromDate, lte: toDate },
          ...(query.warehouseId
            ? { customer: { warehouseId: query.warehouseId } }
            : {}),
        },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ]);

    // ── warehouse name map ───────────────────────────────────────────────────
    // Collect unique warehouses from all records
    const warehouseMap = new Map<string, string>(); // id → name
    payments.forEach((p) => {
      if (p.customer.warehouse) {
        warehouseMap.set(
          p.customer.warehouse.id,
          p.customer.warehouse.name,
        );
      }
    });
    deliveries.forEach((d) => {
      if (d.warehouseId) {
        // warehouseId but no name; we'll back-fill from payments or a lookup
      }
    });

    // Resolve warehouse names for deliveries & intakes that may be missing from paymentMap
    const missingWarehouseIds = [
      ...new Set([
        ...deliveries.map((d) => d.warehouseId).filter(Boolean),
        ...packages.map((p) => p.warehouseId).filter(Boolean),
      ]),
    ].filter((id) => !warehouseMap.has(id!)) as string[];

    if (missingWarehouseIds.length > 0) {
      const warehouses = await this.prisma.warehouse.findMany({
        where: { id: { in: missingWarehouseIds } },
        select: { id: true, name: true },
      });
      warehouses.forEach((w) => warehouseMap.set(w.id, w.name));
    }

    // ── Group payments by warehouse ─────────────────────────────────────────
    type WarehousePaymentAcc = {
      totalUsd: number;
      totalGhs: number;
      methods: Map<string, { count: number; totalGhs: number; totalUsd: number }>;
      count: number;
    };
    const paymentsByWarehouse = new Map<string, WarehousePaymentAcc>();

    payments.forEach((p) => {
      const wid = p.customer.warehouse?.id;
      if (!wid) return;
      const acc = paymentsByWarehouse.get(wid) ?? {
        totalUsd: 0,
        totalGhs: 0,
        methods: new Map(),
        count: 0,
      };
      acc.count++;
      acc.totalUsd += p.currency === 'USD' ? p.amount : 0;
      acc.totalGhs += p.localAmount ?? 0;

      const method = p.paymentMethod;
      const m = acc.methods.get(method) ?? {
        count: 0,
        totalGhs: 0,
        totalUsd: 0,
      };
      m.count++;
      m.totalGhs += p.localAmount ?? 0;
      m.totalUsd += p.currency === 'USD' ? p.amount : 0;
      acc.methods.set(method, m);
      paymentsByWarehouse.set(wid, acc);
    });

    // ── Group deliveries (pickups) by warehouse ──────────────────────────────
    type WarehousePickupAcc = {
      count: number;
      totalQuantity: number;
      users: Map<string, { name: string; count: number; totalQuantity: number }>;
    };
    const pickupsByWarehouse = new Map<string, WarehousePickupAcc>();

    deliveries.forEach((d) => {
      const wid = d.warehouseId;
      if (!wid) return;
      const acc = pickupsByWarehouse.get(wid) ?? {
        count: 0,
        totalQuantity: 0,
        users: new Map(),
      };
      acc.count++;
      acc.totalQuantity += d.quantity ?? 0;

      const uid = d.createdById;
      const uName = `${d.createdBy.firstName}${d.createdBy.lastName ? ' ' + d.createdBy.lastName : ''}`;
      const u = acc.users.get(uid) ?? { name: uName, count: 0, totalQuantity: 0 };
      u.count++;
      u.totalQuantity += d.quantity ?? 0;
      acc.users.set(uid, u);
      pickupsByWarehouse.set(wid, acc);
    });

    // ── Group intakes by warehouse ───────────────────────────────────────────
    type WarehouseIntakeAcc = {
      count: number;
      totalQuantity: number;
      users: Map<string, { name: string; count: number; totalQuantity: number }>;
    };
    const intakesByWarehouse = new Map<string, WarehouseIntakeAcc>();

    packages.forEach((pkg) => {
      const wid = pkg.warehouseId;
      if (!wid) return;
      const acc = intakesByWarehouse.get(wid) ?? {
        count: 0,
        totalQuantity: 0,
        users: new Map(),
      };
      acc.count++;
      acc.totalQuantity += pkg.quantity ?? 0;

      const uid = pkg.createdById;
      const uName = `${pkg.createdBy.firstName}${pkg.createdBy.lastName ? ' ' + pkg.createdBy.lastName : ''}`;
      const u = acc.users.get(uid) ?? { name: uName, count: 0, totalQuantity: 0 };
      u.count++;
      u.totalQuantity += pkg.quantity ?? 0;
      acc.users.set(uid, u);
      intakesByWarehouse.set(wid, acc);
    });

    // ── Build per-warehouse breakdown ────────────────────────────────────────
    const allWarehouseIds = new Set([
      ...paymentsByWarehouse.keys(),
      ...pickupsByWarehouse.keys(),
      ...intakesByWarehouse.keys(),
    ]);

    const warehouses: EodWarehouseBreakdownDto[] = Array.from(
      allWarehouseIds,
    ).map((wid) => {
      const wName = warehouseMap.get(wid) ?? 'Unknown';

      // Payments
      const pa = paymentsByWarehouse.get(wid);
      const byMethod: EodPaymentMethodDto[] = pa
        ? Array.from(pa.methods.entries()).map(([method, m]) => ({
            method,
            count: m.count,
            totalGhs: Math.round(m.totalGhs * 100) / 100,
            totalUsd: Math.round(m.totalUsd * 100) / 100,
          }))
        : [];
      const warehousePayments: EodWarehousePaymentsDto = {
        count: pa?.count ?? 0,
        totalUsd: Math.round((pa?.totalUsd ?? 0) * 100) / 100,
        totalGhs: Math.round((pa?.totalGhs ?? 0) * 100) / 100,
        byMethod,
      };

      // Pickups
      const pk = pickupsByWarehouse.get(wid);
      const byUserPickup: EodUserPickupDto[] = pk
        ? Array.from(pk.users.entries()).map(([userId, u]) => ({
            userId,
            userName: u.name,
            count: u.count,
            totalQuantity: u.totalQuantity,
          }))
        : [];
      const warehousePickups: EodWarehousePickupsDto = {
        count: pk?.count ?? 0,
        totalQuantity: pk?.totalQuantity ?? 0,
        byUser: byUserPickup,
      };

      // Intakes
      const ia = intakesByWarehouse.get(wid);
      const byUserIntake: EodUserIntakeDto[] = ia
        ? Array.from(ia.users.entries()).map(([userId, u]) => ({
            userId,
            userName: u.name,
            count: u.count,
            totalQuantity: u.totalQuantity,
          }))
        : [];
      const warehouseIntakes: EodWarehouseIntakesDto = {
        count: ia?.count ?? 0,
        totalQuantity: ia?.totalQuantity ?? 0,
        byUser: byUserIntake,
      };

      return {
        warehouseId: wid,
        warehouseName: wName,
        payments: warehousePayments,
        pickups: warehousePickups,
        intakes: warehouseIntakes,
      };
    });

    // ── Overall summary ──────────────────────────────────────────────────────
    const overall: EodOverallSummaryDto = {
      totalPayments: payments.length,
      totalRevenueUsd:
        Math.round(
          payments
            .filter((p) => p.currency === 'USD')
            .reduce((s, p) => s + p.amount, 0) * 100,
        ) / 100,
      totalRevenueGhs:
        Math.round(
          payments.reduce((s, p) => s + (p.localAmount ?? 0), 0) * 100,
        ) / 100,
      totalPickups: deliveries.length,
      totalPickupQuantity: deliveries.reduce(
        (s, d) => s + (d.quantity ?? 0),
        0,
      ),
      totalIntakes: packages.length,
      totalIntakeQuantity: packages.reduce(
        (s, p) => s + (p.quantity ?? 0),
        0,
      ),
      totalInvoicesCreated: invoices._count.id,
      totalInvoiceAmount:
        Math.round((invoices._sum.totalAmount ?? 0) * 100) / 100,
    };

    // ── Activity by user ─────────────────────────────────────────────────────
    type UserAcc = {
      userName: string;
      role: string;
      warehouse?: string;
      paymentsProcessed: number;
      paymentsTotalGhs: number;
      paymentsTotalUsd: number;
      packagesReceived: number;
      intakeQuantity: number;
      pickupsReleased: number;
      pickupQuantity: number;
    };
    const userAccMap = new Map<string, UserAcc>();

    const getOrCreateUser = (uid: string, u: { firstName: string; lastName: string | null; role: string; warehouse: { name: string } | null }): UserAcc => {
      const existing = userAccMap.get(uid);
      if (existing) return existing;
      const acc: UserAcc = {
        userName: `${u.firstName}${u.lastName ? ' ' + u.lastName : ''}`,
        role: u.role,
        warehouse: u.warehouse?.name,
        paymentsProcessed: 0,
        paymentsTotalGhs: 0,
        paymentsTotalUsd: 0,
        packagesReceived: 0,
        intakeQuantity: 0,
        pickupsReleased: 0,
        pickupQuantity: 0,
      };
      userAccMap.set(uid, acc);
      return acc;
    };

    payments.forEach((p) => {
      const acc = getOrCreateUser(p.processedById, p.processedBy as any);
      acc.paymentsProcessed++;
      acc.paymentsTotalGhs += p.localAmount ?? 0;
      acc.paymentsTotalUsd += p.currency === 'USD' ? p.amount : 0;
      userAccMap.set(p.processedById, acc);
    });

    packages.forEach((pkg) => {
      const acc = getOrCreateUser(pkg.createdById, pkg.createdBy as any);
      acc.packagesReceived++;
      acc.intakeQuantity += pkg.quantity ?? 0;
      userAccMap.set(pkg.createdById, acc);
    });

    deliveries.forEach((d) => {
      const acc = getOrCreateUser(d.createdById, d.createdBy as any);
      acc.pickupsReleased++;
      acc.pickupQuantity += d.quantity ?? 0;
      userAccMap.set(d.createdById, acc);
    });

    const activityByUser: EodUserActivityDto[] = Array.from(
      userAccMap.entries(),
    ).map(([userId, acc]) => ({
      userId,
      userName: acc.userName,
      role: acc.role,
      warehouse: acc.warehouse,
      paymentsProcessed: acc.paymentsProcessed,
      paymentsTotalGhs: Math.round(acc.paymentsTotalGhs * 100) / 100,
      paymentsTotalUsd: Math.round(acc.paymentsTotalUsd * 100) / 100,
      packagesReceived: acc.packagesReceived,
      intakeQuantity: acc.intakeQuantity,
      pickupsReleased: acc.pickupsReleased,
      pickupQuantity: acc.pickupQuantity,
    }));

    return {
      reportDate: dateStr,
      fromDate,
      toDate,
      warehouses,
      overall,
      activityByUser,
      generatedAt: new Date(),
    };
  }
}
