import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService {
  constructor(private readonly prisma: PrismaService) {}

  async runAllSeeds(): Promise<void> {
    await this.seedUsers();
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
          mustChangePassword: true,
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
  }
}
