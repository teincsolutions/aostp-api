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
          ? `${customer.firstName}${customer.lastName ? ' ' + customer.lastName : ''}`
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
}
