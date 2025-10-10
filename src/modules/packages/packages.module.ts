import { Module, forwardRef } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../../providers/storage/storage.module';
import { PDFService } from '../../providers/pdf/pdf.service';

@Module({
  imports: [PrismaModule, StorageModule, forwardRef(() => NotificationsModule)],
  controllers: [PackagesController],
  providers: [PackagesService, PDFService],
  exports: [PackagesService],
})
export class PackagesModule {}
