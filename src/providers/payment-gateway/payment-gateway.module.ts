import { Module } from '@nestjs/common';
import { PaymentGatewayService } from './payment-gateway.service';
import { CashProvider } from './providers/cash.provider';
import { BankTransferProvider } from './providers/bank-transfer.provider';
import { MobileMoneyProvider } from './providers/mobile-money.provider';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [
    PaymentGatewayService,
    CashProvider,
    BankTransferProvider,
    MobileMoneyProvider,
  ],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}
