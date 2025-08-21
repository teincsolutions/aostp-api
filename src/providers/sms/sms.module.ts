import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ConsoleSmsProvider } from './console.provider';
import { ArkeselSmsProvider } from './arkesel.provider';
import { AwsSnsProvider } from './aws-sns.provider';
import { SmsOnlineGHProvider } from './sms-online-gh.provider';
import { SmsProvider } from '../../interfaces/sms-provider.interface';

@Module({
  imports: [HttpModule],
  providers: [
    ConsoleSmsProvider,
    ArkeselSmsProvider,
    AwsSnsProvider,
    SmsOnlineGHProvider,
    {
      provide: 'SMS_PROVIDER',
      useFactory: (
        configService: ConfigService,
        consoleProvider: ConsoleSmsProvider,
        arkeselProvider: ArkeselSmsProvider,
        awsSnsProvider: AwsSnsProvider,
        smsOnlineProvider: SmsOnlineGHProvider,
      ): SmsProvider => {
        const provider = configService.get<string>('SMS_PROVIDER', 'console');

        switch (provider.toLowerCase()) {
          case 'arkesel':
            return arkeselProvider;
          case 'aws-sns':
            return awsSnsProvider;
          case 'sms-online-gh':
            return smsOnlineProvider;
          case 'console':
          default:
            return consoleProvider;
        }
      },
      inject: [
        ConfigService,
        ConsoleSmsProvider,
        ArkeselSmsProvider,
        AwsSnsProvider,
        SmsOnlineGHProvider,
      ],
    },
  ],
  exports: ['SMS_PROVIDER'],
})
export class SmsModule {}
