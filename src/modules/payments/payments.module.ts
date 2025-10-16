import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentGatewayModule } from '../../providers/payment-gateway/payment-gateway.module';
import { PDFService } from '../../providers/pdf/pdf.service';

@Module({
  imports: [PaymentGatewayModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PDFService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
