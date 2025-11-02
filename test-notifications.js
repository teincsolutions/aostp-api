const { ConfigService } = require('@nestjs/config');

// Simple test to verify the notifications service setup
async function testNotificationsSetup() {
  try {
    console.log('Testing Notifications Service setup...');

    // Since we can't easily instantiate NestJS services outside the framework,
    // let's just verify the basic structure and imports work
    const fs = require('fs');
    const path = require('path');

    const checks = [
      {
        name: 'Email provider interface',
        pattern: /export interface EmailProvider/,
        file: 'src/interfaces/email-provider.interface.ts',
      },
      {
        name: 'SMS provider interface',
        pattern: /export interface SmsProvider/,
        file: 'src/interfaces/sms-provider.interface.ts',
      },
      {
        name: 'WhatsApp provider interface',
        pattern: /export interface WhatsAppProvider/,
        file: 'src/interfaces/whatsapp-provider.interface.ts',
      },
      {
        name: 'Email module',
        pattern: /export class EmailModule/,
        file: 'src/providers/email/email.module.ts',
      },
      {
        name: 'SMS module',
        pattern: /export class SmsModule/,
        file: 'src/providers/sms/sms.module.ts',
      },
      {
        name: 'WhatsApp module',
        pattern: /export class WhatsAppModule/,
        file: 'src/providers/whatsapp/whatsapp.module.ts',
      },
      {
        name: 'Console email provider',
        pattern: /export class ConsoleEmailProvider/,
        file: 'src/providers/email/console.provider.ts',
      },
      {
        name: 'Nodemailer email provider',
        pattern: /export class NodemailerProvider/,
        file: 'src/providers/email/nodemailer.provider.ts',
      },
      {
        name: 'Console WhatsApp provider',
        pattern: /export class ConsoleWhatsAppProvider/,
        file: 'src/providers/whatsapp/console.provider.ts',
      },
      {
        name: 'Meta WhatsApp provider',
        pattern: /export class MetaWhatsAppProvider/,
        file: 'src/providers/whatsapp/meta.provider.ts',
      },
      {
        name: 'Notifications module imports',
        pattern: /SmsModule.*EmailModule.*WhatsAppModule/,
        file: 'src/modules/notifications/notifications.module.ts',
      },
      {
        name: 'Notifications service imports',
        pattern: /import type.*WhatsAppProvider/,
        file: 'src/modules/notifications/notifications.service.ts',
      },
      {
        name: 'Notifications service constructor',
        pattern: /@Inject.*WHATSAPP_PROVIDER/,
        file: 'src/modules/notifications/notifications.service.ts',
      },
      {
        name: 'sendEmail method implementation',
        pattern: /this\.emailProvider\.sendEmail/,
        file: 'src/modules/notifications/notifications.service.ts',
      },
      {
        name: 'sendSMS method implementation',
        pattern: /this\.smsProvider\.sendSms/,
        file: 'src/modules/notifications/notifications.service.ts',
      },
      {
        name: 'sendWhatsApp method implementation',
        pattern: /this\.whatsAppProvider\.sendMessage/,
        file: 'src/modules/notifications/notifications.service.ts',
      },
    ];

    let passedChecks = 0;
    checks.forEach((check) => {
      try {
        const content = fs.readFileSync(
          path.join(__dirname, check.file),
          'utf8',
        );
        if (check.pattern.test(content)) {
          console.log(`✅ ${check.name}`);
          passedChecks++;
        } else {
          console.log(`❌ ${check.name} - NOT FOUND`);
        }
      } catch (error) {
        console.log(`❌ ${check.name} - FILE NOT FOUND: ${check.file}`);
      }
    });

    console.log(
      `\nTest Results: ${passedChecks}/${checks.length} checks passed`,
    );

    if (passedChecks === checks.length) {
      console.log('🎉 All notifications setup checks passed!');
      console.log('\nTo use the notification system:');
      console.log(
        '1. Set EMAIL_PROVIDER=console (or nodemailer) in your environment',
      );
      console.log(
        '2. Set SMS_PROVIDER=hubtel (or console) in your environment',
      );
      console.log(
        '3. Set WHATSAPP_PROVIDER=console (or meta) in your environment',
      );
      console.log('4. Configure provider credentials as needed:');
      console.log(
        '   - Meta WhatsApp: META_WHATSAPP_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID',
      );
      console.log(
        '5. Use the notification methods like notifyPackageIntake(), notifyInvoiceIssued(), etc.',
      );
      console.log('\nWhatsApp notifications are now fully integrated! 🚀');
    } else {
      console.log(
        '❌ Some setup checks failed. Please review the implementation.',
      );
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testNotificationsSetup();
