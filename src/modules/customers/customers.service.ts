import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { PaginatedResult } from '../../shared/interfaces';
import { Customer, Prisma } from '@prisma/client';
import { CUSTOMER_CODE_PREFIX } from '../../shared/constants';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    // Check if customer with same phone number exists
    const existingCustomer = await this.prisma.customer.findFirst({
      where: { phoneNumber: createCustomerDto.phoneNumber },
    });

    if (existingCustomer) {
      throw new ConflictException(
        'Customer with this phone number already exists',
      );
    }

    // Check if email is provided and unique
    if (createCustomerDto.email) {
      const emailExists = await this.prisma.customer.findFirst({
        where: { email: createCustomerDto.email },
      });

      if (emailExists) {
        throw new ConflictException('Customer with this email already exists');
      }
    }

    // Generate customer code
    const customerCode = await this.generateCustomerCode();

    return this.prisma.customer.create({
      data: {
        ...createCustomerDto,
        customerCode,
      },
    });
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      search?: string;
      isActive?: boolean;
      city?: string;
      country?: string;
    },
  ): Promise<PaginatedResult<Customer>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters?.city && {
        city: { contains: filters.city, mode: 'insensitive' },
      }),
      ...(filters?.country && {
        country: { contains: filters.country, mode: 'insensitive' },
      }),
      ...(filters?.search && {
        OR: [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { phoneNumber: { contains: filters.search } },
          { customerCode: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              packages: true,
              invoices: true,
              payments: true,
            },
          },
        },
      }),
      this.prisma.customer.count({ where }),
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

  async findOne(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        packages: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            packages: true,
            invoices: true,
            payments: true,
            notifications: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async findByCode(customerCode: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { customerCode },
      include: {
        packages: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            packages: true,
            invoices: true,
            payments: true,
            notifications: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async findByPhone(phoneNumber: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: {
        OR: [{ phoneNumber }, { alternatePhone: phoneNumber }],
      },
    });
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Check if phone number is being updated and is unique
    if (
      updateCustomerDto.phoneNumber &&
      updateCustomerDto.phoneNumber !== customer.phoneNumber
    ) {
      const phoneExists = await this.prisma.customer.findFirst({
        where: {
          phoneNumber: updateCustomerDto.phoneNumber,
          NOT: { id },
        },
      });

      if (phoneExists) {
        throw new ConflictException('Phone number already in use');
      }
    }

    // Check if email is being updated and is unique
    if (updateCustomerDto.email && updateCustomerDto.email !== customer.email) {
      const emailExists = await this.prisma.customer.findFirst({
        where: {
          email: updateCustomerDto.email,
          NOT: { id },
        },
      });

      if (emailExists) {
        throw new ConflictException('Email already in use');
      }
    }

    return this.prisma.customer.update({
      where: { id },
      data: updateCustomerDto,
    });
  }

  async remove(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            packages: true,
            invoices: true,
            payments: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Check if customer has related records
    const hasRelatedRecords =
      customer._count.packages > 0 ||
      customer._count.invoices > 0 ||
      customer._count.payments > 0;

    if (hasRelatedRecords) {
      // Soft delete - just deactivate the customer
      return this.prisma.customer.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // Hard delete if no related records
    return this.prisma.customer.delete({
      where: { id },
    });
  }

  async getCustomerStats(id: string) {
    const customer = await this.findOne(id);

    const [
      totalPackages,
      pendingPackages,
      deliveredPackages,
      totalInvoices,
      unpaidInvoices,
      totalPayments,
      totalSpent,
    ] = await Promise.all([
      this.prisma.package.count({
        where: { customerId: id },
      }),
      this.prisma.package.count({
        where: {
          customerId: id,
          status: {
            in: ['RECEIVED', 'IN_WAREHOUSE', 'IN_PACKING_LIST', 'SHIPPED'],
          },
        },
      }),
      this.prisma.package.count({
        where: {
          customerId: id,
          status: 'DELIVERED',
        },
      }),
      this.prisma.invoice.count({
        where: { customerId: id },
      }),
      this.prisma.invoice.count({
        where: {
          customerId: id,
          status: { in: ['POSTED', 'DRAFT'] },
        },
      }),
      this.prisma.payment.count({
        where: { customerId: id },
      }),
      this.prisma.payment.aggregate({
        where: { customerId: id },
        _sum: { amount: true },
      }),
    ]);

    return {
      customer,
      stats: {
        totalPackages,
        pendingPackages,
        deliveredPackages,
        totalInvoices,
        unpaidInvoices,
        totalPayments,
        totalSpent: totalSpent._sum.amount || 0,
      },
    };
  }

  private async generateCustomerCode(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    // Get the last customer code for this month
    const lastCustomer = await this.prisma.customer.findFirst({
      where: {
        customerCode: {
          startsWith: `${CUSTOMER_CODE_PREFIX}${year}${month}`,
        },
      },
      orderBy: {
        customerCode: 'desc',
      },
    });

    let sequence = 1;
    if (lastCustomer) {
      const lastSequence = parseInt(lastCustomer.customerCode.slice(-4));
      sequence = lastSequence + 1;
    }

    return `${CUSTOMER_CODE_PREFIX}${year}${month}${sequence.toString().padStart(4, '0')}`;
  }
}
