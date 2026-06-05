import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Prisma, User, UserRole } from '@prisma/client';
import { hash, compare } from 'bcrypt';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createUserDto: CreateUserDto, creatorId: string): Promise<any> {
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      role,
      warehouseId,
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

    // Store plain password temporarily to send via email
    const tempPassword = password;

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          firstName,
          lastName,
          role,
          ...(warehouseId && { warehouseId }), // Only include if provided
          isActive,
          twoFactorEnabled,
          mustChangePassword: true, // Force password change on first login
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          warehouseId: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
          isActive: true,
          twoFactorEnabled: true,
          mustChangePassword: true,
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
          metadata: {
            createdUserEmail: email,
            createdUserRole: role,
          },
        },
      });

      return user;
    });

    // Send welcome email with credentials (async, don't block)
    if (result.email) {
      this.notificationsService
        .notifyUserCreated({
          id: result.id,
          email: result.email,
          username: result.username,
          firstName: result.firstName,
          lastName: result.lastName,
          role: result.role,
          tempPassword,
        })
        .catch((error) => {
          this.logger.error(
            `Failed to send welcome email to ${result.email}:`,
            error,
          );
        });
    }

    this.logger.log(`User created: ${email} with role ${role}`);
    return result;
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
          warehouseId: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
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
        warehouseId: true,
        warehouse: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
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

    // Explicitly clear nullable warehouse assignment when empty is provided.
    if (
      Object.prototype.hasOwnProperty.call(updateUserDto, 'warehouseId') &&
      (updateUserDto.warehouseId === '' ||
        updateUserDto.warehouseId === undefined)
    ) {
      updateData.warehouseId = null;
    }

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

    // Check if role is being changed
    const roleChanged =
      updateUserDto.role && updateUserDto.role !== existingUser.role;

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
          warehouseId: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
        },
      });

      // If role changed, invalidate all refresh tokens
      if (roleChanged) {
        await tx.refreshToken.updateMany({
          where: { userId: id },
          data: { revokedAt: new Date() },
        });

        // Log role change and session invalidation
        await tx.auditLog.create({
          data: {
            userId: updaterId,
            action: 'SECURITY_EVENT',
            entity: 'User',
            entityId: id,
            metadata: {
              action: 'ROLE_CHANGE_SESSION_INVALIDATION',
              oldRole: existingUser.role,
              newRole: updatedUser.role,
              sessionsInvalidated: true,
            },
          },
        });

        this.logger.log(
          `User role changed from ${existingUser.role} to ${updatedUser.role} - all sessions invalidated for ${updatedUser.email}`,
        );
      }

      // Log the general update action
      await tx.auditLog.create({
        data: {
          userId: updaterId,
          action: 'UPDATE',
          entity: 'User',
          entityId: id,
          metadata: {
            updatedUserEmail: existingUser.email,
            changedFields: Object.keys(updateUserDto),
          },
        },
      });

      return updatedUser;
    });

    if (roleChanged) {
      this.logger.warn(
        `Security Alert: User role change detected - sessions invalidated for user ${result.email}`,
      );
    }

    this.logger.log(`User updated: ${result.email}`);
    return result as any;
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
          metadata: {
            action: 'DEACTIVATED',
            userEmail: existingUser.email,
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
          warehouseId: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
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
          metadata: {
            action: 'ACTIVATED',
            userEmail: existingUser.email,
          },
        },
      });

      return activatedUser;
    });

    this.logger.log(`User activated: ${result.email}`);
    return result as any;
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
          metadata: {
            deletedUserEmail: existingUser.email,
            deletedUserRole: existingUser.role,
          },
        },
      });

      return deletedUser;
    });

    this.logger.log(`User deleted: ${result.email}`);
    return result;
  }

  async requestPasswordReset(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive) {
      throw new BadRequestException('Account is deactivated');
    }

    if (!user.email) {
      throw new BadRequestException('User has no email address');
    }

    // Generate unique reset token
    const crypto = await import('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Set expiration to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Save reset token to database
    await this.prisma.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Send password reset email (async, don't block)
    this.notificationsService
      .notifyPasswordReset({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        resetToken,
      })
      .catch((error) => {
        this.logger.error(
          `Failed to send password reset email to ${user.email}:`,
          error,
        );
      });

    this.logger.log(`Password reset requested for user: ${user.email}`);

    return {
      success: true,
      message: 'Password reset link has been sent to your email',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    // Find the reset token
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token has been used
    if (resetToken.usedAt) {
      throw new BadRequestException('This reset token has already been used');
    }

    // Check if token is expired
    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestException('This reset token has expired');
    }

    // Check if user is active
    if (!resetToken.user.isActive) {
      throw new BadRequestException('Account is deactivated');
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await hash(newPassword, saltRounds);

    await this.prisma.$transaction(async (tx) => {
      // Update password and clear mustChangePassword flag
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          password: hashedPassword,
          mustChangePassword: false,
        },
      });

      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });

      // Revoke all refresh tokens
      await tx.refreshToken.updateMany({
        where: { userId: resetToken.userId },
        data: { revokedAt: new Date() },
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: resetToken.userId,
          action: 'PASSWORD_RESET',
          entity: 'User',
          entityId: resetToken.userId,
          metadata: {
            action: 'PASSWORD_RESET_VIA_TOKEN',
            tokenUsed: true,
          },
        },
      });
    });

    this.logger.log(
      `Password reset successful for user: ${resetToken.user.email}`,
    );

    return {
      success: true,
      message:
        'Password has been reset successfully. Please login with your new password.',
    };
  }
}
