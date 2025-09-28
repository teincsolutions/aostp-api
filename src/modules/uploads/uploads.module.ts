import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { StorageModule } from '../../providers/storage/storage.module';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
  imports: [StorageModule],
})
export class UploadsModule {}
