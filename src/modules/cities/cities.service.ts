import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { PaginatedResult } from '../../shared/interfaces';
import { City, Prisma } from '@prisma/client';

@Injectable()
export class CitiesService {
  constructor(private prisma: PrismaService) {}

  async create(createCityDto: CreateCityDto): Promise<City> {
    // Check if city with same name and country exists
    const existingCity = await this.prisma.city.findUnique({
      where: {
        name_country: {
          name: createCityDto.name,
          country: createCityDto.country,
        },
      },
    });

    if (existingCity) {
      throw new ConflictException(
        'City with this name already exists in the specified country',
      );
    }

    return this.prisma.city.create({
      data: createCityDto,
    });
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      search?: string;
      country?: string;
    },
  ): Promise<PaginatedResult<City>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.CityWhereInput = {
      ...(filters?.country && {
        country: { contains: filters.country, mode: 'insensitive' },
      }),
      ...(filters?.search && {
        name: { contains: filters.search, mode: 'insensitive' },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.city.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.city.count({ where }),
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

  async findOne(id: string): Promise<City> {
    const city = await this.prisma.city.findUnique({
      where: { id },
      include: {
        shippingRates: true,
        _count: {
          select: {
            shippingRates: true,
          },
        },
      },
    });

    if (!city) {
      throw new NotFoundException('City not found');
    }

    return city;
  }

  async update(id: string, updateCityDto: UpdateCityDto): Promise<City> {
    const city = await this.prisma.city.findUnique({
      where: { id },
    });

    if (!city) {
      throw new NotFoundException('City not found');
    }

    // Check if updating to a duplicate
    if (
      (updateCityDto.name && updateCityDto.country) ||
      (updateCityDto.name && !updateCityDto.country) ||
      (!updateCityDto.name && updateCityDto.country)
    ) {
      const newName = updateCityDto.name || city.name;
      const newCountry = updateCityDto.country || city.country;

      if (newName !== city.name || newCountry !== city.country) {
        const existingCity = await this.prisma.city.findUnique({
          where: {
            name_country: {
              name: newName,
              country: newCountry,
            },
          },
        });

        if (existingCity && existingCity.id !== id) {
          throw new ConflictException(
            'City with this name already exists in the specified country',
          );
        }
      }
    }

    return this.prisma.city.update({
      where: { id },
      data: updateCityDto,
    });
  }

  async remove(id: string): Promise<City> {
    const city = await this.prisma.city.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            shippingRates: true,
          },
        },
      },
    });

    if (!city) {
      throw new NotFoundException('City not found');
    }

    // Check if city has related shipping rates
    if (city._count.shippingRates > 0) {
      throw new ConflictException(
        'Cannot delete city with existing shipping rates',
      );
    }

    return this.prisma.city.delete({
      where: { id },
    });
  }

  async findByCountry(country: string): Promise<City[]> {
    return await this.prisma.city.findMany({
      where: {
        country: { equals: country, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
    });
  }
}
