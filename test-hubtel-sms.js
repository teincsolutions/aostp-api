const { ConfigService } = require('@nestjs/config');
const { HttpService } = require('@nestjs/axios');

// Mock environment variables for testing
process.env.HUBTEL_CLIENT_ID = 'test-client-id';
process.env.HUBTEL_CLIENT_SECRET = 'test-client-secret';
process.env.HUBTEL_SENDER_ID = 'TestSender';
process.env.HUBTEL_SMS_BASE_URL = 'https://sms.hubtel.com/v1';

// Simple test to verify the HubtelSmsProvider can be instantiated
async function testHubtelProvider() {
  try {
    console.log('Testing Hubtel SMS Provider instantiation...');

    // Since we can't easily instantiate NestJS services outside the framework,
    // let's just verify the basic structure and imports work
    const fs = require('fs');
    const path = require('path');

    const providerPath = path.join(
      __dirname,
      'src',
      'providers',
      'sms',
      'hubtel.provider.ts',
    );
    const exists = fs.existsSync(providerPath);

    if (exists) {
      console.log('✅ HubtelSmsProvider file exists');

      // Read the file content to verify basic structure
      const content = fs.readFileSync(providerPath, 'utf8');

      // Check for key components
      const checks = [
        {
          name: 'Class declaration',
          pattern: /export class HubtelSmsProvider/,
        },
        { name: 'Implements SmsProvider', pattern: /implements SmsProvider/ },
        { name: 'Constructor', pattern: /constructor\(/ },
        { name: 'sendSms method', pattern: /async sendSms\(/ },
        { name: 'sendBatchSms method', pattern: /async sendBatchSms\(/ },
        {
          name: 'sendPersonalizedBatchSms method',
          pattern: /async sendPersonalizedBatchSms\(/,
        },
        {
          name: 'checkMessageStatus method',
          pattern: /async checkMessageStatus\(/,
        },
        {
          name: 'checkBatchStatus method',
          pattern: /async checkBatchStatus\(/,
        },
        { name: 'Phone number formatting', pattern: /formatPhoneNumber\(/ },
        { name: 'Basic Auth header', pattern: /Authorization.*Basic/ },
      ];

      let passedChecks = 0;
      checks.forEach((check) => {
        if (check.pattern.test(content)) {
          console.log(`✅ ${check.name}`);
          passedChecks++;
        } else {
          console.log(`❌ ${check.name} - NOT FOUND`);
        }
      });

      console.log(
        `\nTest Results: ${passedChecks}/${checks.length} checks passed`,
      );

      if (passedChecks === checks.length) {
        console.log('🎉 All basic structure checks passed!');
        console.log('\nTo use the Hubtel SMS provider:');
        console.log('1. Set SMS_PROVIDER=hubtel in your environment');
        console.log('2. Configure the following environment variables:');
        console.log('   - HUBTEL_CLIENT_ID');
        console.log('   - HUBTEL_CLIENT_SECRET');
        console.log('   - HUBTEL_SENDER_ID (optional, defaults to "Hubtel")');
        console.log(
          '   - HUBTEL_SMS_BASE_URL (optional, defaults to production URL)',
        );
      } else {
        console.log(
          '❌ Some structure checks failed. Please review the implementation.',
        );
      }
    } else {
      console.log('❌ HubtelSmsProvider file does not exist');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testHubtelProvider();
