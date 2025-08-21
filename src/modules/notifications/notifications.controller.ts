import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('customer/:customerId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  @ApiOperation({ summary: 'Get customer notification history' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 50 })
  async getCustomerNotifications(
    @Param('customerId') customerId: string,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getCustomerNotifications(
      customerId,
      limit,
    );
  }

  @Post('retry-failed')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry failed notifications from last 24 hours' })
  @ApiResponse({ status: 200, description: 'Retry initiated' })
  async retryFailedNotifications() {
    return this.notificationsService.retryFailedNotifications();
  }
}
