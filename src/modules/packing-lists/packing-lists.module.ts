import { Module } from '@nestjs/common';
import { PackingListsService } from './packing-lists.service';
import { PackingListsController } from './packing-lists.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PDFService } from '../../providers/pdf/pdf.service';
import { StorageModule } from '../../providers/storage/storage.module';

@Module({
  imports: [PrismaModule, InvoicesModule, NotificationsModule, StorageModule],
  controllers: [PackingListsController],
  providers: [PackingListsService, PDFService],
  exports: [PackingListsService],
})
export class PackingListsModule {}
