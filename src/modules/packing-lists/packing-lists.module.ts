import { Module } from '@nestjs/common';
import { PackingListsService } from './packing-lists.service';
import { PackingListsController } from './packing-lists.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PackingListsController],
  providers: [PackingListsService],
  exports: [PackingListsService],
})
export class PackingListsModule {}
