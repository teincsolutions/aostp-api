import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from '../../config/env.validation';
import { SharedModule } from '../shared.module';
import { SeedService } from './seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      cache: true,
    }),
    SharedModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
