import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { GetNotificationsDto } from './dto/notifications.filter.dto';
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

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all notifications with filters' })
  async getAllNotifications(@Query() query: GetNotificationsDto) {
    return this.notificationsService.getAllNotifications(query);
  }

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

  @Post(':id/retry')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a single failed notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Retry initiated' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({
    status: 400,
    description: 'Notification is not in failed status',
  })
  async retrySingleNotification(@Param('id') id: string) {
    try {
      return await this.notificationsService.retrySingleNotification(id);
    } catch (error) {
      if (error.message === 'Notification not found') {
        throw new NotFoundException(error.message);
      }
      if (error.message === 'Notification is not in failed status') {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get('failed')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all failed notifications' })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 100 })
  async getFailedNotifications(@Query('limit') limit?: number) {
    return this.notificationsService.getFailedNotifications(limit);
  }

  @Post('test-sms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send test SMS - for testing SMS provider configuration',
  })
  @ApiResponse({ status: 200, description: 'Test SMS sent' })
  @UseGuards() // Make this endpoint public - no authentication required
  async testSms(@Body() body: { phoneNumber: string; message?: string }) {
    const {
      phoneNumber,
      message = 'Test SMS from AOSTP Logistics - Hubtel integration test',
    } = body;

    try {
      const result = await this.notificationsService.sendTestSms(
        phoneNumber,
        message,
      );

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error sending test SMS',
        error: error.message,
      };
    }
  }
}
