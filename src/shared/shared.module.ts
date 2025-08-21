import { Global, Module } from '@nestjs/common';
import { IdGeneratorService } from './utils/id-generator.service';
import { PrismaModule } from './prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [IdGeneratorService],
  exports: [IdGeneratorService],
})
export class SharedModule {}
