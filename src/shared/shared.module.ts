import { Global, Module } from '@nestjs/common';
import { IdGeneratorService } from './utils/id-generator.service';
import { PrismaModule } from './prisma/prisma.module';
import { LoggingModule } from './logging/logging.module';

@Global()
@Module({
  imports: [PrismaModule, LoggingModule],
  providers: [IdGeneratorService],
  exports: [IdGeneratorService],
})
export class SharedModule {}
