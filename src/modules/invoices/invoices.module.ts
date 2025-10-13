import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { StorageModule } from '../../providers/storage/storage.module';
import { PDFService } from '../../providers/pdf/pdf.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, PDFService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
