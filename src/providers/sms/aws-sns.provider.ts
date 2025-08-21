import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import {
  SmsProvider,
  SmsResponse,
} from '../../interfaces/sms-provider.interface';

@Injectable()
export class AwsSnsProvider implements SmsProvider {
  private readonly logger = new Logger(AwsSnsProvider.name);
  private sns: AWS.SNS;

  constructor(private configService: ConfigService) {
    this.initializeAWS();
  }

  private initializeAWS() {
    try {
      const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');

      // Only initialize AWS SNS if credentials are provided
      if (!accessKeyId || !secretAccessKey) {
        this.logger.warn(
          'AWS SNS credentials not provided - skipping initialization',
        );
        return;
      }

      this.sns = new AWS.SNS({
        accessKeyId,
        secretAccessKey,
        region: this.configService.get('AWS_REGION', 'us-east-1'),
      });

      this.logger.log('AWS SNS initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AWS SNS:', error);
    }
  }

  async sendSms(phone: string, message: string): Promise<SmsResponse> {
    try {
      if (!this.sns) {
        return {
          success: false,
          error: 'AWS SNS client not initialized. Check AWS configuration.',
        };
      }

      const params = {
        Message: message,
        PhoneNumber: phone,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional',
          },
        },
      };

      const result = await this.sns.publish(params).promise();

      this.logger.log(
        `SMS sent successfully via AWS SNS to ${phone}: ${result.MessageId}`,
      );
      return {
        success: true,
        messageId: result.MessageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS via AWS SNS to ${phone}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown AWS SNS error',
      };
    }
  }

  getName(): string {
    return 'AWS SNS';
  }
}
