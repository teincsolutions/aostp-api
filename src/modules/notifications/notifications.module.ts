import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { SmsModule } from '../../providers/sms/sms.module';
import { EmailModule } from '../../providers/email/email.module';
import { WhatsAppModule } from '../../providers/whatsapp/whatsapp.module';

@Module({
  imports: [PrismaModule, SmsModule, EmailModule, WhatsAppModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
