import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WebhookController } from './webhook.controller';
import { PaymentGatewayModule } from '../../providers/payment-gateway/payment-gateway.module';
import { StorageModule } from '../../providers/storage/storage.module';
import { PDFService } from '../../providers/pdf/pdf.service';
import { CallbackTokenService } from 'src/providers/payment-gateway/callback-token.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [PaymentGatewayModule, StorageModule],
  controllers: [PaymentsController, WebhookController],
  providers: [PaymentsService, PDFService, CallbackTokenService, JwtService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
