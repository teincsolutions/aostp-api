import { Module } from '@nestjs/common';
import { PackageDeliveryService } from './package-delivery.service';
import { PackageDeliveryController } from './package-delivery.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { IdGeneratorService } from '../../shared/utils/id-generator.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PackageDeliveryController],
  providers: [PackageDeliveryService, IdGeneratorService],
  exports: [PackageDeliveryService],
})
export class PackageDeliveryModule {}
