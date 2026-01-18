import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsQueue } from './notifications.queue';
import { NotificationsProcessor } from './notifications.processor';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { SmsModule } from '../../providers/sms/sms.module';
import { EmailModule } from '../../providers/email/email.module';
import { WhatsAppModule } from '../../providers/whatsapp/whatsapp.module';
import { StorageModule } from '../../providers/storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    SmsModule,
    EmailModule,
    WhatsAppModule,
    StorageModule,
    BullModule.registerQueue({
      name: 'notifications-queue',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsQueue, NotificationsProcessor],
  exports: [NotificationsService, NotificationsQueue],
})
export class NotificationsModule {}
