import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ConsoleWhatsAppProvider } from './console.provider';
import { MetaWhatsAppProvider } from './meta.provider';
import { WhatsAppProvider } from '../../interfaces/whatsapp-provider.interface';

@Module({
  imports: [HttpModule],
  providers: [
    ConsoleWhatsAppProvider,
    MetaWhatsAppProvider,
    {
      provide: 'WHATSAPP_PROVIDER',
      useFactory: (
        configService: ConfigService,
        consoleProvider: ConsoleWhatsAppProvider,
        metaProvider: MetaWhatsAppProvider,
      ): WhatsAppProvider => {
        const provider = configService.get<string>(
          'WHATSAPP_PROVIDER',
          'console',
        );

        switch (provider.toLowerCase()) {
          case 'meta':
            return metaProvider;
          case 'console':
          default:
            return consoleProvider;
        }
      },
      inject: [ConfigService, ConsoleWhatsAppProvider, MetaWhatsAppProvider],
    },
  ],
  exports: ['WHATSAPP_PROVIDER', MetaWhatsAppProvider],
})
export class WhatsAppModule {}
