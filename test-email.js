const { ConfigService } = require('@nestjs/config');
const {
  NodemailerProvider,
} = require('./dist/providers/email/nodemailer.provider');

// Load environment variables
require('dotenv').config();

// Simple test to send a real email
async function testEmailSending() {
  try {
    console.log('Testing real email sending with Nodemailer...');

    // Create config service
    const configService = new ConfigService();

    // Create nodemailer provider
    const emailProvider = new NodemailerProvider(configService);

    if (!emailProvider.isProviderConfigured()) {
      console.log(
        '❌ Email provider is not configured. Please check your SMTP settings in .env',
      );
      return;
    }

    console.log('📧 Sending test email...');

    const result = await emailProvider.sendEmail(
      'emensah@teincsolutions.com', // Replace with your test email
      'Test Email from AOSTP API',
      '<h1>Hello from AOSTP Logistics!</h1><p>This is a test email to verify the email provider is working correctly.</p>',
      { html: true },
    );

    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('📨 Message ID:', result.messageId);
    } else {
      console.log('❌ Email sending failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testEmailSending();
