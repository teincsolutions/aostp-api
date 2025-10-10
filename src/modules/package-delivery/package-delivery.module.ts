import { Module } from '@nestjs/common';
import { PackageDeliveryService } from './package-delivery.service';
import { PackageDeliveryController } from './package-delivery.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { IdGeneratorService } from '../../shared/utils/id-generator.service';
import { NotificationsService } from '../notifications/notifications.service';

@Module({
  imports: [PrismaModule],
  controllers: [PackageDeliveryController],
  providers: [PackageDeliveryService, IdGeneratorService, NotificationsService],
  exports: [PackageDeliveryService],
})
export class PackageDeliveryModule {}
