import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { StorageModule } from '../../providers/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
