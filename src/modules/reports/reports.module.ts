import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsQueue } from './reports.queue';
import { ReportsProcessor } from './reports.processor';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'reports-queue',
    }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsQueue, ReportsProcessor],
  exports: [ReportsService, ReportsQueue],
})
export class ReportsModule {}
