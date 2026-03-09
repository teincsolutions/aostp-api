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
import { Customer, InvoiceStatus, Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(createCustomerDto: CreateCustomerDto, userId?: string): Promise<Customer> {
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

    // Check if ID number is provided and unique
    if (createCustomerDto.idType && createCustomerDto.idNumber) {
      const idExists = await this.prisma.customer.findFirst({
        where: {
          idType: createCustomerDto.idType,
          idNumber: createCustomerDto.idNumber,
        },
      });

      if (idExists) {
        throw new ConflictException(
          `Customer with this ${createCustomerDto.idType.toLowerCase().replace('_', ' ')} already exists`,
        );
      }
    }

    // Generate customer code: first name + last 5 digits of phone
    const namePart = createCustomerDto.firstName
      .replace(/\s/g, '')
      .toUpperCase();
    const phonePart = createCustomerDto.phoneNumber.slice(-5);
    let customerCode = `${namePart}-${phonePart}`;
    let counter = 0;

    // Ensure uniqueness
    while (true) {
      const existingCustomer = await this.prisma.customer.findFirst({
        where: { customerCode },
      });

      if (!existingCustomer) {
        break;
      }

      counter++;
      customerCode = `${namePart}${phonePart}${counter}`;
    }

    const customer = await this.prisma.customer.create({
      data: {
        ...createCustomerDto,
        customerCode,
      },
    });

    // Create audit log if userId is provided
    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entity: 'Customer',
          entityId: customer.id,
          after: customer as any,
          metadata: {
            customerCode: customer.customerCode,
          },
        },
      });
    }

    return customer;
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      search?: string;
      isActive?: boolean;
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
          warehouse: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
          cityRef: {
            select: {
              id: true,
              name: true,
              country: true,
            },
          },
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
        warehouse: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        cityRef: {
          select: {
            id: true,
            name: true,
            country: true,
          },
        },
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
        warehouse: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        cityRef: {
          select: {
            id: true,
            name: true,
            country: true,
          },
        },
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
    userId?: string,
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

    // Check if ID is being updated and is unique
    if (updateCustomerDto.idType && updateCustomerDto.idNumber) {
      const isIdChanged =
        updateCustomerDto.idType !== customer.idType ||
        updateCustomerDto.idNumber !== customer.idNumber;

      if (isIdChanged) {
        const idExists = await this.prisma.customer.findFirst({
          where: {
            idType: updateCustomerDto.idType,
            idNumber: updateCustomerDto.idNumber,
            NOT: { id },
          },
        });

        if (idExists) {
          throw new ConflictException(
            `Customer with this ${updateCustomerDto.idType.toLowerCase().replace('_', ' ')} already exists`,
          );
        }
      }
    }

    const updatedCustomer = await this.prisma.customer.update({
      where: { id },
      data: updateCustomerDto,
    });

    // Create audit log if userId is provided
    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entity: 'Customer',
          entityId: id,
          before: customer as any,
          after: updatedCustomer as any,
          metadata: {
            customerCode: customer.customerCode,
            changedFields: Object.keys(updateCustomerDto),
          },
        },
      });
    }

    return updatedCustomer;
  }

  async remove(id: string, userId?: string): Promise<Customer> {
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

    let result: Customer;
    let action: string;

    if (hasRelatedRecords) {
      // Soft delete - just deactivate the customer
      result = await this.prisma.customer.update({
        where: { id },
        data: { isActive: false },
      });
      action = 'DEACTIVATE';
    } else {
      // Hard delete if no related records
      result = await this.prisma.customer.delete({
        where: { id },
      });
      action = 'DELETE';
    }

    // Create audit log if userId is provided
    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entity: 'Customer',
          entityId: id,
          before: customer as any,
          metadata: {
            customerCode: customer.customerCode,
            hardDelete: action === 'DELETE',
          },
        },
      });
    }

    return result;
  }

  async forceDelete(
    id: string,
    confirmName: string,
    userId?: string,
  ): Promise<{ deleted: boolean; summary: Record<string, number> }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Build expected confirmation name
    const fullName = customer.lastName
      ? `${customer.firstName} ${customer.lastName}`
      : customer.firstName;

    if (confirmName.trim() !== fullName.trim()) {
      throw new BadRequestException(
        `Confirmation name does not match. Expected: "${fullName}"`,
      );
    }

    // Collect counts before deletion for the summary
    const [
      packageDeliveryCount,
      paymentCount,
      notificationCount,
      invoiceCount,
      packageItemCount,
      packageCount,
    ] = await Promise.all([
      this.prisma.packageDelivery.count({ where: { customerId: id } }),
      this.prisma.payment.count({ where: { customerId: id } }),
      this.prisma.notification.count({ where: { customerId: id } }),
      this.prisma.invoice.count({ where: { customerId: id } }),
      this.prisma.packageItem.count({ where: { customerId: id } }),
      this.prisma.package.count({ where: { customerId: id } }),
    ]);

    // Cascade delete in dependency order within a single transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Deliveries reference Invoice + Package + Customer — delete first
      await tx.packageDelivery.deleteMany({ where: { customerId: id } });

      // 2. Payments — deleting rows cascades the implicit Payment<->Invoice join table
      await tx.payment.deleteMany({ where: { customerId: id } });

      // 3. Notifications
      await tx.notification.deleteMany({ where: { customerId: id } });

      // 4. Invoices — safe now that deliveries and payment-join rows are gone
      await tx.invoice.deleteMany({ where: { customerId: id } });

      // 5. PackageItems — cascades PackageItemPhotos; must precede Package deletion
      await tx.packageItem.deleteMany({ where: { customerId: id } });

      // 6. Packages — cascades PackagePhotos
      await tx.package.deleteMany({ where: { customerId: id } });

      // 7. Customer itself
      await tx.customer.delete({ where: { id } });
    });

    // Audit log recorded after the transaction succeeds
    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'FORCE_DELETE',
          entity: 'Customer',
          entityId: id,
          before: customer as any,
          metadata: {
            customerCode: customer.customerCode,
            confirmedName: confirmName,
            deletedRecords: {
              packageDeliveries: packageDeliveryCount,
              payments: paymentCount,
              notifications: notificationCount,
              invoices: invoiceCount,
              packageItems: packageItemCount,
              packages: packageCount,
            },
          },
        },
      });
    }

    return {
      deleted: true,
      summary: {
        packageDeliveries: packageDeliveryCount,
        payments: paymentCount,
        notifications: notificationCount,
        invoices: invoiceCount,
        packageItems: packageItemCount,
        packages: packageCount,
      },
    };
  }

  async getCustomerStats(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        packages: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        invoices: true,
        payments: {
          include: {
            exchangeRate: true,
          },
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
            in: ['RECEIVED', 'ASSIGNED', 'SHIPPED'],
          },
        },
      }),
      this.prisma.package.count({
        where: {
          customerId: id,
          status: 'RELEASED',
        },
      }),
      this.prisma.invoice.count({
        where: { customerId: id },
      }),
      this.prisma.invoice.count({
        where: {
          customerId: id,
          status: InvoiceStatus.UNPAID,
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
}
