import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleEmailProvider } from './console.provider';
import { NodemailerProvider } from './nodemailer.provider';
import { EmailProvider } from '../../interfaces/email-provider.interface';

@Module({
  providers: [
    ConsoleEmailProvider,
    NodemailerProvider,
    {
      provide: 'EMAIL_PROVIDER',
      useFactory: (
        configService: ConfigService,
        consoleProvider: ConsoleEmailProvider,
        nodemailerProvider: NodemailerProvider,
      ): EmailProvider => {
        const provider = configService.get<string>('EMAIL_PROVIDER', 'console');

        switch (provider.toLowerCase()) {
          case 'nodemailer':
            return nodemailerProvider;
          case 'console':
          default:
            return consoleProvider;
        }
      },
      inject: [ConfigService, ConsoleEmailProvider, NodemailerProvider],
    },
  ],
  exports: ['EMAIL_PROVIDER'],
})
export class EmailModule {}
