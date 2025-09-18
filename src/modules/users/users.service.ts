import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Prisma, User, UserRole } from '@prisma/client';
import { hash, compare } from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, creatorId: string): Promise<User> {
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      role,
      isActive = true,
      twoFactorEnabled = false,
    } = createUserDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('A user with this email already exists');
      }
      if (existingUser.username === username) {
        throw new ConflictException('A user with this username already exists');
      }
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await hash(password, saltRounds);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          firstName,
          lastName,
          role,
          isActive,
          twoFactorEnabled,
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: creatorId,
          action: 'CREATE',
          entity: 'User',
          entityId: user.id,
          after: user as any,
          metadata: {
            createdUserEmail: email,
            createdUserRole: role,
          },
        },
      });

      return user;
    });

    this.logger.log(`User created: ${email} with role ${role}`);
    return result as User;
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: {
      role?: UserRole | null;
      isActive?: boolean;
      search?: string;
    },
  ) {
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (filters?.role) {
      // Validate that the role is a valid UserRole enum value
      const validRoles = Object.values(UserRole);
      if (!validRoles.includes(filters.role)) {
        throw new BadRequestException(
          `Invalid role: ${filters.role}. Valid roles are: ${validRoles.join(', ')}`,
        );
      }
      where.role = filters.role;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { username: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
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

  async findOne(id: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        _count: {
          select: {
            auditLogs: true,
            refreshTokens: true,
            packagesCreated: true,
            paymentsProcessed: true,
            exchangeRatesSet: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    updaterId: string,
  ): Promise<User> {
    const existingUser = await this.findOne(id);

    const updateData: any = { ...updateUserDto };

    // Check for conflicts if email or username is being updated
    if (updateUserDto.email || updateUserDto.username) {
      const conflictUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            ...(updateUserDto.email ? [{ email: updateUserDto.email }] : []),
            ...(updateUserDto.username
              ? [{ username: updateUserDto.username }]
              : []),
          ],
          id: { not: id },
        },
      });

      if (conflictUser) {
        if (conflictUser.email === updateUserDto.email) {
          throw new ConflictException('A user with this email already exists');
        }
        if (conflictUser.username === updateUserDto.username) {
          throw new ConflictException(
            'A user with this username already exists',
          );
        }
      }
    }

    // Hash password if provided
    if (updateUserDto.password) {
      const saltRounds = 12;
      updateData.password = await hash(updateUserDto.password, saltRounds);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: updaterId,
          action: 'UPDATE',
          entity: 'User',
          entityId: id,
          before: existingUser,
          after: updatedUser,
        },
      });

      return updatedUser;
    });

    this.logger.log(`User updated: ${result.email}`);
    return result as User;
  }

  async deactivate(id: string, deactivatorId: string): Promise<User> {
    const existingUser = await this.findOne(id);

    if (!existingUser.isActive) {
      throw new BadRequestException('User is already deactivated');
    }

    // Prevent deactivating the last super admin
    if (existingUser.role === UserRole.SUPER_ADMIN) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          role: UserRole.SUPER_ADMIN,
          isActive: true,
          id: { not: id },
        },
      });

      if (activeAdminCount === 0) {
        throw new BadRequestException(
          'Cannot deactivate the last active super admin',
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const deactivatedUser = await tx.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
        },
      });

      // Revoke all refresh tokens for the user
      await tx.refreshToken.updateMany({
        where: { userId: id },
        data: { revokedAt: new Date() },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: deactivatorId,
          action: 'UPDATE',
          entity: 'User',
          entityId: id,
          before: existingUser,
          after: deactivatedUser,
          metadata: {
            action: 'DEACTIVATED',
          },
        },
      });

      return deactivatedUser;
    });

    this.logger.log(`User deactivated: ${result.email}`);
    return result as User;
  }

  async activate(id: string, activatorId: string): Promise<User> {
    const existingUser = await this.findOne(id);

    if (existingUser.isActive) {
      throw new BadRequestException('User is already active');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const activatedUser = await tx.user.update({
        where: { id },
        data: { isActive: true },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
        },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: activatorId,
          action: 'UPDATE',
          entity: 'User',
          entityId: id,
          before: existingUser,
          after: activatedUser,
          metadata: {
            action: 'ACTIVATED',
          },
        },
      });

      return activatedUser;
    });

    this.logger.log(`User activated: ${result.email}`);
    return result as User;
  }

  async getUserStats() {
    const [totalUsers, usersByRole, activeUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
        orderBy: { role: 'asc' },
      }),
      this.prisma.user.count({ where: { isActive: true } }),
    ]);

    return {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      byRole: usersByRole,
    };
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  }

  async changePassword(
    id: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, password: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify old password
    const isValidPassword = await compare(oldPassword, user.password);
    if (!isValidPassword) {
      throw new BadRequestException('Invalid current password');
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await hash(newPassword, saltRounds);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { password: hashedPassword },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: id,
          action: 'PASSWORD_CHANGE',
          entity: 'User',
          entityId: id,
          metadata: {
            action: 'PASSWORD_CHANGED',
          },
        },
      });
    });

    this.logger.log(`Password changed for user: ${user.email}`);
  }

  async remove(id: string, removerId: string): Promise<User> {
    const existingUser = await this.findOne(id);

    // Prevent deleting the last super admin
    if (existingUser.role === UserRole.SUPER_ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: {
          role: UserRole.SUPER_ADMIN,
          id: { not: id },
        },
      });

      if (adminCount === 0) {
        throw new BadRequestException('Cannot delete the last super admin');
      }
    }

    // Check if user has related data that would prevent deletion
    const relatedDataCount = await this.prisma.auditLog.count({
      where: { userId: id },
    });

    if (relatedDataCount > 0) {
      throw new BadRequestException(
        'Cannot delete user with associated audit logs. Consider deactivating instead.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Delete refresh tokens first
      await tx.refreshToken.deleteMany({
        where: { userId: id },
      });

      const deletedUser = await tx.user.delete({
        where: { id },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: removerId,
          action: 'DELETE',
          entity: 'User',
          entityId: id,
          before: existingUser,
        },
      });

      return deletedUser;
    });

    this.logger.log(`User deleted: ${result.email}`);
    return result;
  }
}
