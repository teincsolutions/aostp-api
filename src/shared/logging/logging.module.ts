import { Module } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { UploadsModule } from '../../modules/uploads/uploads.module';

@Module({
  imports: [UploadsModule],
  providers: [LoggingService],
  exports: [LoggingService],
})
export class LoggingModule {}
