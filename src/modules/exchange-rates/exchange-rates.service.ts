import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { UpdateExchangeRateDto } from './dto/update-exchange-rate.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Prisma, ExchangeRate } from '@prisma/client';
import { roundToTwoDecimals } from '../../shared/utils/decimal.utils';

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    createExchangeRateDto: CreateExchangeRateDto,
    userId: string,
  ): Promise<ExchangeRate> {
    const { fromCurrency, toCurrency, rate, effectiveFrom, effectiveTo } =
      createExchangeRateDto;

    // Round rate to 2 decimal places to ensure consistency
    const roundedRate = roundToTwoDecimals(rate);

    // Check if there's already an active rate for this currency pair
    const existingActiveRate = await this.prisma.exchangeRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        isActive: true,
        effectiveTo: null,
      },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // If there's an existing active rate, deactivate it
      if (existingActiveRate) {
        await tx.exchangeRate.update({
          where: { id: existingActiveRate.id },
          data: {
            isActive: false,
            effectiveTo: new Date(),
          },
        });
      }

      // Create new rate
      const newRate = await tx.exchangeRate.create({
        data: {
          fromCurrency,
          toCurrency,
          rate: roundedRate,
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
          effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
          isActive: true,
          setById: userId,
        },
        include: {
          setBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entity: 'ExchangeRate',
          entityId: newRate.id,
          metadata: {
            currencyPair: `${fromCurrency}/${toCurrency}`,
            rate: roundedRate,
            previousRateId: existingActiveRate?.id,
          },
        },
      });

      return newRate;
    });

    this.logger.log(
      `Exchange rate created: ${fromCurrency}/${toCurrency} = ${roundedRate}`,
    );
    return result;
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      fromCurrency?: string;
      toCurrency?: string;
      isActive?: boolean;
    },
  ) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.ExchangeRateWhereInput = {};

    if (filters?.fromCurrency) {
      where.fromCurrency = filters.fromCurrency;
    }

    if (filters?.toCurrency) {
      where.toCurrency = filters.toCurrency;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.exchangeRate.findMany({
        where,
        skip,
        take: limit,
        include: {
          setBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              payments: true,
            },
          },
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.exchangeRate.count({ where }),
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

  async findOne(id: string): Promise<ExchangeRate> {
    const exchangeRate = await this.prisma.exchangeRate.findUnique({
      where: { id },
      include: {
        setBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        payments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: true,
          },
        },
      },
    });

    if (!exchangeRate) {
      throw new NotFoundException(`Exchange rate with ID ${id} not found`);
    }

    return exchangeRate;
  }

  async getCurrentRate(
    fromCurrency: string = 'USD',
    toCurrency: string,
  ): Promise<ExchangeRate> {
    const currentRate = await this.prisma.exchangeRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        isActive: true,
        effectiveFrom: {
          lte: new Date(),
        },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!currentRate) {
      throw new NotFoundException(
        `No active exchange rate found for ${fromCurrency}/${toCurrency}`,
      );
    }

    return currentRate;
  }

  async update(
    id: string,
    updateExchangeRateDto: UpdateExchangeRateDto,
    userId: string,
  ): Promise<ExchangeRate> {
    const existingRate = await this.findOne(id);

    // If deactivating, check if it's the only active rate for this pair
    if (updateExchangeRateDto.isActive === false) {
      const activeRatesCount = await this.prisma.exchangeRate.count({
        where: {
          fromCurrency: existingRate.fromCurrency,
          toCurrency: existingRate.toCurrency,
          isActive: true,
          id: { not: id },
        },
      });

      if (activeRatesCount === 0) {
        throw new BadRequestException(
          'Cannot deactivate the only active rate for this currency pair',
        );
      }
    }

    const updateData: any = { ...updateExchangeRateDto };

    if (updateExchangeRateDto.effectiveTo) {
      updateData.effectiveTo = new Date(updateExchangeRateDto.effectiveTo);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedRate = await tx.exchangeRate.update({
        where: { id },
        data: updateData,
        include: {
          setBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'ExchangeRate',
          entityId: id,
          metadata: {
            currencyPair: `${existingRate.fromCurrency}/${existingRate.toCurrency}`,
          },
        },
      });

      return updatedRate;
    });

    this.logger.log(
      `Exchange rate updated: ${result.fromCurrency}/${result.toCurrency} = ${result.rate}`,
    );
    return result;
  }

  async deactivate(id: string, userId: string): Promise<ExchangeRate> {
    const existingRate = await this.findOne(id);

    if (!existingRate.isActive) {
      throw new BadRequestException('Exchange rate is already inactive');
    }

    // Check if it's the only active rate for this pair
    const activeRatesCount = await this.prisma.exchangeRate.count({
      where: {
        fromCurrency: existingRate.fromCurrency,
        toCurrency: existingRate.toCurrency,
        isActive: true,
        id: { not: id },
      },
    });

    if (activeRatesCount === 0) {
      throw new BadRequestException(
        'Cannot deactivate the only active rate for this currency pair',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const deactivatedRate = await tx.exchangeRate.update({
        where: { id },
        data: {
          isActive: false,
          effectiveTo: new Date(),
        },
        include: {
          setBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'ExchangeRate',
          entityId: id,
          metadata: {
            action: 'DEACTIVATED',
            currencyPair: `${existingRate.fromCurrency}/${existingRate.toCurrency}`,
          },
        },
      });

      return deactivatedRate;
    });

    this.logger.log(
      `Exchange rate deactivated: ${result.fromCurrency}/${result.toCurrency}`,
    );
    return result;
  }

  async getHistoricalRates(
    fromCurrency: string = 'USD',
    toCurrency: string,
    limit = 50,
  ) {
    return this.prisma.exchangeRate.findMany({
      where: {
        fromCurrency,
        toCurrency,
      },
      include: {
        setBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
      take: limit,
    });
  }

  async getActiveCurrencyPairs() {
    const activePairs = await this.prisma.exchangeRate.findMany({
      where: {
        isActive: true,
      },
      select: {
        fromCurrency: true,
        toCurrency: true,
        rate: true,
        effectiveFrom: true,
      },
      distinct: ['fromCurrency', 'toCurrency'],
      orderBy: [{ fromCurrency: 'asc' }, { toCurrency: 'asc' }],
    });

    return activePairs;
  }

  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ) {
    const roundedAmount = roundToTwoDecimals(amount);

    if (fromCurrency === toCurrency) {
      return {
        originalAmount: roundedAmount,
        convertedAmount: roundedAmount,
        rate: 1,
        fromCurrency,
        toCurrency,
      };
    }

    const exchangeRate = await this.getCurrentRate(fromCurrency, toCurrency);
    const convertedAmount = roundToTwoDecimals(
      roundedAmount * exchangeRate.rate,
    );

    return {
      originalAmount: roundedAmount,
      convertedAmount,
      rate: exchangeRate.rate,
      fromCurrency,
      toCurrency,
      exchangeRateId: exchangeRate.id,
      effectiveFrom: exchangeRate.effectiveFrom,
    };
  }

  async remove(id: string, userId: string): Promise<ExchangeRate> {
    const existingRate = await this.findOne(id);

    // Check if the rate has been used in payments
    const usageCount = await this.prisma.payment.count({
      where: { exchangeRateId: id },
    });

    if (usageCount > 0) {
      throw new BadRequestException(
        'Cannot delete exchange rate that has been used in payments',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const deletedRate = await tx.exchangeRate.delete({
        where: { id },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELETE',
          entity: 'ExchangeRate',
          entityId: id,
          metadata: {
            currencyPair: `${existingRate.fromCurrency}/${existingRate.toCurrency}`,
            rate: existingRate.rate,
          },
        },
      });

      return deletedRate;
    });

    this.logger.log(
      `Exchange rate deleted: ${result.fromCurrency}/${result.toCurrency}`,
    );
    return result;
  }
}
