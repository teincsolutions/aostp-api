import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { validate } from './config/env.validation';
import { PrismaModule } from './shared/prisma/prisma.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PackagesModule } from './modules/packages/packages.module';
import { PackingListsModule } from './modules/packing-lists/packing-lists.module';
import { ContainersModule } from './modules/containers/containers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ShippingRatesModule } from './modules/shipping-rates/shipping-rates.module';
import { UsersModule } from './modules/users/users.module';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';
import { CorrelationIdInterceptor } from './shared/interceptors/correlation-id.interceptor';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      cache: true,
    }),
    PrismaModule,
    SharedModule,
    AuthModule,
    CustomersModule,
    PackagesModule,
    PackingListsModule,
    ContainersModule,
    NotificationsModule,
    ExchangeRatesModule,
    InvoicesModule,
    PaymentsModule,
    ShippingRatesModule,
    UsersModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
