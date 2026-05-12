import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
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
import { HealthModule } from './modules/health/health.module';
import { WhatsAppWebhookModule } from './modules/whatsapp-webhook/whatsapp-webhook.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { ConsolidationModule } from './modules/consolidation/consolidation.module';
import { PackageDeliveryModule } from './modules/package-delivery/package-delivery.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { LoggingModule } from './shared/logging/logging.module';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';
import { PasswordChangeGuard } from './shared/guards/password-change.guard';
import { CorrelationIdInterceptor } from './shared/interceptors/correlation-id.interceptor';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { CitiesModule } from './modules/cities/cities.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      cache: true,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            if (times > 3) {
              // Stop retrying after 3 attempts - return null to stop
              return null;
            }
            return Math.min(times * 1000, 3000);
          },
        },
      }),
    }),
    PrismaModule,
    SharedModule,
    LoggingModule,
    AuditLogsModule,
    AuthModule,
    CitiesModule,
    CustomersModule,
    DashboardModule,
    PackagesModule,
    PackingListsModule,
    ContainersModule,
    NotificationsModule,
    ExchangeRatesModule,
    InvoicesModule,
    PaymentsModule,
    ShippingRatesModule,
    UsersModule,
    HealthModule,
    UploadsModule,
    ConsolidationModule,
    PackageDeliveryModule,
    WarehousesModule,
    ReportsModule,
    WhatsAppWebhookModule,
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
      provide: APP_GUARD,
      useClass: PasswordChangeGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
