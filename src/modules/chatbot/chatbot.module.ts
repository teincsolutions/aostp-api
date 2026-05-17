import { Module, OnModuleInit } from '@nestjs/common';
import { ChatbotService } from './services/chatbot.service';
import { TrackPackageHandler } from './handlers/track-package.handler';
import { InvoiceLookupHandler } from './handlers/invoice-lookup.handler';
import { PaymentLookupHandler } from './handlers/payment-lookup.handler';
import { PhoneLookupHandler } from './handlers/phone-lookup.handler';
import { HelpMenuHandler } from './handlers/help-menu.handler';

@Module({
  providers: [
    ChatbotService,
    InvoiceLookupHandler,
    PaymentLookupHandler,
    TrackPackageHandler,
    PhoneLookupHandler,
    HelpMenuHandler,
  ],
  exports: [ChatbotService],
})
export class ChatbotModule implements OnModuleInit {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly invoiceLookupHandler: InvoiceLookupHandler,
    private readonly paymentLookupHandler: PaymentLookupHandler,
    private readonly trackPackageHandler: TrackPackageHandler,
    private readonly phoneLookupHandler: PhoneLookupHandler,
    private readonly helpMenuHandler: HelpMenuHandler,
  ) {}

  onModuleInit(): void {
    this.chatbotService.register(this.invoiceLookupHandler);
    this.chatbotService.register(this.paymentLookupHandler);
    this.chatbotService.register(this.trackPackageHandler);
    this.chatbotService.register(this.phoneLookupHandler);
    this.chatbotService.register(this.helpMenuHandler);
  }
}
