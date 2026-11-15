import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { CustomersExportService } from './customers-export.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomersExportService],
  exports: [CustomersService],
})
export class CustomersModule {}
