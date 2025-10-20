import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, IdType, NotificationChannel } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService {
  constructor(private readonly prisma: PrismaService) {}

  async runAllSeeds(): Promise<void> {
    await this.seedUsers();
    //await this.seedCustomers();
  }

  private async seedUsers(): Promise<void> {
    console.log('Creating default super admin and sample users...');

    // Create default super admin user
    const adminEmail = 'admin@aostp.com';
    const adminPassword = 'Admin@123456'; // Change this in production!

    const existingAdmin = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      const admin = await this.prisma.user.create({
        data: {
          email: adminEmail,
          username: 'admin',
          password: hashedPassword,
          firstName: 'System',
          lastName: 'Administrator',
          role: UserRole.SUPER_ADMIN,
          isActive: true,
        },
      });

      console.log('Created super admin user:', {
        email: admin.email,
        username: admin.username,
        role: admin.role,
      });
    } else {
      console.log('Super admin user already exists');
    }

    // Create sample users for other roles
    const sampleUsers = [
      {
        email: 'finance@aostp.com',
        username: 'finance_manager',
        password: 'Finance@123456',
        firstName: 'Finance',
        lastName: 'Manager',
        role: UserRole.FINANCE_MANAGER,
      },
      {
        email: 'operations@aostp.com',
        username: 'operations_clerk',
        password: 'Operations@123456',
        firstName: 'Operations',
        lastName: 'Clerk',
        role: UserRole.OPERATIONS_CLERK,
      },
      {
        email: 'payment@aostp.com',
        username: 'payment_clerk',
        password: 'Payment@123456',
        firstName: 'Payment',
        lastName: 'Clerk',
        role: UserRole.PAYMENT_CLERK,
      },
    ];

    for (const userData of sampleUsers) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        const user = await this.prisma.user.create({
          data: {
            ...userData,
            password: hashedPassword,
            isActive: true,
          },
        });

        console.log(`Created ${userData.role} user:`, {
          email: user.email,
          username: user.username,
          role: user.role,
        });
      } else {
        console.log(`${userData.role} user already exists`);
      }
    }
  }

  private async seedCustomers(): Promise<void> {
    console.log('Creating sample customers...');

    const sampleCustomers = [
      {
        customerCode: 'CUST240101',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phoneNumber: '+233244123456',
        alternatePhone: '+233201234567',
        address: '123 Main Street',
        city: 'Accra',
        country: 'Ghana',
        idType: IdType.NATIONAL_ID,
        idNumber: 'GHA-123456789-0',
        preferredChannel: NotificationChannel.EMAIL,
      },
      {
        customerCode: 'CUST240102',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phoneNumber: '+233244987654',
        address: '456 Liberty Avenue',
        city: 'Kumasi',
        country: 'Ghana',
        idType: IdType.PASSPORT,
        idNumber: 'G1234567',
        preferredChannel: NotificationChannel.SMS,
      },
      {
        customerCode: 'CUST240103',
        firstName: 'Michael',
        lastName: 'Johnson',
        phoneNumber: '+233244555666',
        address: '789 Independence Road',
        city: 'Takoradi',
        country: 'Ghana',
        preferredChannel: NotificationChannel.WHATSAPP,
      },
    ];

    for (const customerData of sampleCustomers) {
      const existingCustomer = await this.prisma.customer.findUnique({
        where: { customerCode: customerData.customerCode },
      });

      if (!existingCustomer) {
        const customer = await this.prisma.customer.create({
          data: customerData,
        });

        console.log('Created customer:', {
          customerCode: customer.customerCode,
          name: `${customer.firstName} ${customer.lastName}`,
          phoneNumber: customer.phoneNumber,
        });
      } else {
        console.log(`Customer ${customerData.customerCode} already exists`);
      }
    }
  }
}
