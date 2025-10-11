import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateShippingRateDto } from './dto/create-shipping-rate.dto';
import { UpdateShippingRateDto } from './dto/update-shipping-rate.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import {
  Prisma,
  ShippingRate,
  ShippingMode,
  AirShippingType,
} from '@prisma/client';

@Injectable()
export class ShippingRatesService {
  private readonly logger = new Logger(ShippingRatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    createShippingRateDto: CreateShippingRateDto,
    userId: string,
  ): Promise<ShippingRate> {
    const {
      shippingMode,
      airShippingType,
      cityId,
      ratePerUnit,
      currency = 'USD',
      effectiveFrom,
      effectiveTo,
      isActive = true,
    } = createShippingRateDto;

    // Validate air shipping type for air mode
    if (shippingMode === ShippingMode.AIR && !airShippingType) {
      throw new BadRequestException(
        'Air shipping type is required for air shipping mode',
      );
    }

    if (shippingMode === ShippingMode.SEA && airShippingType) {
      throw new BadRequestException(
        'Air shipping type should not be provided for sea shipping mode',
      );
    }

    const effectiveFromDate = effectiveFrom
      ? new Date(effectiveFrom)
      : new Date();

    // Check for existing active rate with the same configuration
    const existingActiveRate = await this.prisma.shippingRate.findFirst({
      where: {
        shippingMode,
        airShippingType: airShippingType || null,
        cityId,
        isActive: true,
        effectiveTo: null,
      },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // If there's an existing active rate, deactivate it
      if (existingActiveRate) {
        await tx.shippingRate.update({
          where: { id: existingActiveRate.id },
          data: {
            isActive: false,
            effectiveTo: new Date(),
          },
        });
      }

      // Create new rate
      const newRate = await tx.shippingRate.create({
        data: {
          shippingMode,
          airShippingType,
          cityId,
          ratePerUnit,
          currency,
          effectiveFrom: effectiveFromDate,
          effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
          isActive,
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entity: 'ShippingRate',
          entityId: newRate.id,
          after: newRate as any,
          metadata: {
            shippingMode,
            airShippingType,
            ratePerUnit,
            currency,
            previousRateId: existingActiveRate?.id,
          },
        },
      });

      return newRate;
    });

    this.logger.log(
      `Shipping rate created: ${shippingMode}${airShippingType ? ` - ${airShippingType}` : ''} = ${ratePerUnit} ${currency}`,
    );

    return result;
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      shippingMode?: ShippingMode;
      airShippingType?: AirShippingType;
      isActive?: boolean;
      currency?: string;
    },
  ) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.ShippingRateWhereInput = {};

    if (filters?.shippingMode) {
      where.shippingMode = filters.shippingMode;
    }

    if (filters?.airShippingType) {
      where.airShippingType = filters.airShippingType;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.currency) {
      where.currency = filters.currency;
    }

    const [data, total] = await Promise.all([
      this.prisma.shippingRate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.shippingRate.count({ where }),
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

  async findOne(id: string): Promise<ShippingRate> {
    const shippingRate = await this.prisma.shippingRate.findUnique({
      where: { id },
    });

    if (!shippingRate) {
      throw new NotFoundException(`Shipping rate with ID ${id} not found`);
    }

    return shippingRate;
  }

  async getCurrentRate(
    shippingMode: ShippingMode,
    airShippingType?: AirShippingType,
  ): Promise<ShippingRate> {
    const currentRate = await this.prisma.shippingRate.findFirst({
      where: {
        shippingMode,
        airShippingType: airShippingType || null,
        isActive: true,
        effectiveFrom: {
          lte: new Date(),
        },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!currentRate) {
      const rateType = `${shippingMode}${airShippingType ? ` - ${airShippingType}` : ''}`;
      throw new NotFoundException(
        `No active shipping rate found for ${rateType}`,
      );
    }

    return currentRate;
  }

  async update(
    id: string,
    updateShippingRateDto: UpdateShippingRateDto,
    userId: string,
  ): Promise<ShippingRate> {
    const existingRate = await this.findOne(id);

    const updateData: any = { ...updateShippingRateDto };

    if (updateShippingRateDto.effectiveTo) {
      updateData.effectiveTo = new Date(updateShippingRateDto.effectiveTo);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedRate = await tx.shippingRate.update({
        where: { id },
        data: updateData,
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'ShippingRate',
          entityId: id,
          before: existingRate as any,
          after: updatedRate as any,
        },
      });

      return updatedRate;
    });

    this.logger.log(
      `Shipping rate updated: ${result.shippingMode}${
        result.airShippingType ? ` - ${result.airShippingType}` : ''
      } = ${result.ratePerUnit} ${result.currency}`,
    );

    return result;
  }

  async deactivate(id: string, userId: string): Promise<ShippingRate> {
    const existingRate = await this.findOne(id);

    if (!existingRate.isActive) {
      throw new BadRequestException('Shipping rate is already inactive');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const deactivatedRate = await tx.shippingRate.update({
        where: { id },
        data: {
          isActive: false,
          effectiveTo: new Date(),
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'ShippingRate',
          entityId: id,
          before: existingRate as any,
          after: deactivatedRate as any,
          metadata: {
            action: 'DEACTIVATED',
          },
        },
      });

      return deactivatedRate;
    });

    this.logger.log(
      `Shipping rate deactivated: ${result.shippingMode}${
        result.airShippingType ? ` - ${result.airShippingType}` : ''
      }`,
    );

    return result;
  }

  async getActiveRates() {
    return this.prisma.shippingRate.findMany({
      where: {
        isActive: true,
        effectiveFrom: {
          lte: new Date(),
        },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: [
        { shippingMode: 'asc' },
        { airShippingType: 'asc' },
        { effectiveFrom: 'desc' },
      ],
    });
  }

  async getHistoricalRates(
    shippingMode: ShippingMode,
    airShippingType?: AirShippingType,
    limit = 50,
  ) {
    return this.prisma.shippingRate.findMany({
      where: {
        shippingMode,
        airShippingType: airShippingType || null,
      },
      orderBy: { effectiveFrom: 'desc' },
      take: limit,
    });
  }

  async calculateShippingCost(
    shippingMode: ShippingMode,
    airShippingType: AirShippingType | undefined,
    weight: number,
    cbm?: number,
  ) {
    const rate = await this.getCurrentRate(shippingMode, airShippingType);

    let cost: number;
    let unit: string;

    if (shippingMode === ShippingMode.SEA) {
      if (!cbm || cbm <= 0) {
        throw new BadRequestException(
          'CBM is required for sea shipping cost calculation',
        );
      }
      cost = cbm * rate.ratePerUnit;
      unit = 'CBM';
    } else {
      cost = weight * rate.ratePerUnit;
      unit = 'KG';
    }

    return {
      shippingMode,
      airShippingType,
      ratePerUnit: rate.ratePerUnit,
      unit,
      quantity: shippingMode === ShippingMode.SEA ? cbm : weight,
      totalCost: cost,
      currency: rate.currency,
      rateId: rate.id,
      effectiveFrom: rate.effectiveFrom,
    };
  }

  async remove(id: string, userId: string): Promise<ShippingRate> {
    const existingRate = await this.findOne(id);

    // Check if the rate has been used (this would require checking packages or invoices)
    // For now, we'll allow deletion but log it properly

    const result = await this.prisma.$transaction(async (tx) => {
      const deletedRate = await tx.shippingRate.delete({
        where: { id },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELETE',
          entity: 'ShippingRate',
          entityId: id,
          before: existingRate as any,
        },
      });

      return deletedRate;
    });

    this.logger.log(
      `Shipping rate deleted: ${result.shippingMode}${
        result.airShippingType ? ` - ${result.airShippingType}` : ''
      }`,
    );

    return result;
  }
}
