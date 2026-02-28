/**
 * Live Notification Test
 * 
 * This test sends actual emails and logs SMS messages to verify
 * that invoice links work correctly.
 * 
 * Run with: npm run test:e2e -- --testPathPattern=notification-live
 * 
 * IMPORTANT: Set these environment variables before running:
 * - TEST_EMAIL_RECIPIENT: Email address to receive test notification
 * - TEST_PHONE_RECIPIENT: Phone number for SMS log testing
 * - FRONTEND_URL: Frontend URL for invoice links (default: http://localhost:3000)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NodemailerProvider } from '../src/providers/email/nodemailer.provider';
import { ConsoleSmsProvider } from '../src/providers/sms/console.provider';
import * as dotenv from 'dotenv';

// Load .env before tests run
dotenv.config();

describe('Live Notification Test - Email & SMS', () => {
  let emailProvider: NodemailerProvider;
  let smsProvider: ConsoleSmsProvider;
  let configService: ConfigService;

  // Test configuration - loaded from .env
  const TEST_EMAIL = process.env.TEST_EMAIL_RECIPIENT || 'test@example.com';
  const TEST_PHONE = process.env.TEST_PHONE_RECIPIENT || '+233241234567';
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

  // Simulated invoice data
  const mockInvoiceData = {
    invoiceNumber: 'INV-TEST-2026-001',
    accessToken: 'test-access-token-abc123xyz',
    packingListName: 'PL-2026-CHN-001',
    customerFirstName: 'John',
    customerLastName: 'Doe',
    totalAmount: '1,250.00',
    currency: 'USD',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 30 days from now
  };

  beforeAll(async () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('ENVIRONMENT CONFIGURATION');
    console.log('='.repeat(60));
    console.log(`TEST_EMAIL: ${TEST_EMAIL}`);
    console.log(`TEST_PHONE: ${TEST_PHONE}`);
    console.log(`FRONTEND_URL: ${FRONTEND_URL}`);
    console.log('='.repeat(60));
    console.log('');

    // Load real environment configuration
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env', '.env.local'],
        }),
      ],
      providers: [
        NodemailerProvider,
        ConsoleSmsProvider,
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
    emailProvider = module.get<NodemailerProvider>(NodemailerProvider);
    smsProvider = module.get<ConsoleSmsProvider>(ConsoleSmsProvider);
  });

  /**
   * Generate the invoice URL that customers will click
   */
  function getPublicInvoiceUrl(accessToken: string): string {
    return `${FRONTEND_URL}/invoice/${accessToken}`;
  }

  /**
   * Generate the invoice PDF download URL
   */
  function getInvoicePdfUrl(accessToken: string): string {
    return `${FRONTEND_URL}/invoice/${accessToken}/pdf`;
  }

  describe('Invoice Notification Links', () => {
    it('should generate correct invoice URLs', () => {
      const invoiceUrl = getPublicInvoiceUrl(mockInvoiceData.accessToken);
      const pdfUrl = getInvoicePdfUrl(mockInvoiceData.accessToken);

      console.log('='.repeat(60));
      console.log('INVOICE URL TEST');
      console.log('='.repeat(60));
      console.log(`Invoice View URL: ${invoiceUrl}`);
      console.log(`Invoice PDF URL: ${pdfUrl}`);
      console.log('='.repeat(60));

      expect(invoiceUrl).toContain('/invoice/');
      expect(invoiceUrl).toContain(mockInvoiceData.accessToken);
      expect(pdfUrl).toContain('/pdf');
    });
  });

  describe('SMS Notification (Console Log)', () => {
    it('should log SMS with invoice link and packing list name', async () => {
      const invoiceUrl = getPublicInvoiceUrl(mockInvoiceData.accessToken);
      
      // SMS content with packing list name included
      const smsContent = `Hi ${mockInvoiceData.customerFirstName}, invoice ${mockInvoiceData.invoiceNumber} (${mockInvoiceData.packingListName}) for ${mockInvoiceData.currency}${mockInvoiceData.totalAmount} is due ${mockInvoiceData.dueDate}. View your invoice: ${invoiceUrl}`;

      console.log('');
      console.log('='.repeat(60));
      console.log('SMS NOTIFICATION TEST');
      console.log('='.repeat(60));
      console.log(`Recipient: ${TEST_PHONE}`);
      console.log(`Message Length: ${smsContent.length} characters`);
      console.log('');
      console.log('SMS CONTENT:');
      console.log('-'.repeat(60));
      console.log(smsContent);
      console.log('-'.repeat(60));
      console.log('');

      // Send via console provider (logs to console)
      const result = await smsProvider.sendSms(TEST_PHONE, smsContent);

      console.log(`SMS Send Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`Message ID: ${result.messageId}`);
      console.log('='.repeat(60));
      console.log('');

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(smsContent).toContain(mockInvoiceData.packingListName);
      expect(smsContent).toContain(invoiceUrl);
    });

    it('should log SMS without packing list if not available', async () => {
      const invoiceUrl = getPublicInvoiceUrl(mockInvoiceData.accessToken);
      
      // SMS content without packing list name
      const smsContent = `Hi ${mockInvoiceData.customerFirstName}, invoice ${mockInvoiceData.invoiceNumber} for ${mockInvoiceData.currency}${mockInvoiceData.totalAmount} is due ${mockInvoiceData.dueDate}. View your invoice: ${invoiceUrl}`;

      console.log('');
      console.log('='.repeat(60));
      console.log('SMS WITHOUT PACKING LIST TEST');
      console.log('='.repeat(60));

      const result = await smsProvider.sendSms(TEST_PHONE, smsContent);

      console.log(`SMS Content: ${smsContent}`);
      console.log(`SMS Send Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log('='.repeat(60));
      console.log('');

      expect(result.success).toBe(true);
    });
  });

  describe('Email Notification (Live)', () => {
    it('should send real email with invoice link and packing list name', async () => {
      const invoiceUrl = getPublicInvoiceUrl(mockInvoiceData.accessToken);
      const customerName = `${mockInvoiceData.customerFirstName} ${mockInvoiceData.customerLastName}`;

      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #1a3c6e 0%, #0d2244 100%); padding: 36px 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0 0 6px 0; font-size: 26px; font-weight: bold;">INVOICE ISSUED</h1>
            <p style="color: #a8c4e8; margin: 0; font-size: 15px;">AOSTP International Logistics</p>
          </div>
          <div style="padding: 28px 30px 0 30px;">
            <p style="color: #333; font-size: 16px;">Dear <strong>${customerName}</strong>,</p>
            <p style="color: #555; font-size: 14px;">An invoice has been issued for your shipment. This is a <strong>TEST EMAIL</strong> to verify notification links.</p>
          </div>
          <div style="margin: 0 30px 20px 30px; border: 1px solid #dce3ec; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f0f4f9; padding: 10px 18px; border-bottom: 1px solid #dce3ec;">
              <p style="margin: 0; font-size: 12px; font-weight: bold; color: #1a3c6e; text-transform: uppercase;">Invoice Details</p>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #eef1f5;">
                <td style="padding: 10px 18px; color: #666; font-size: 14px; width: 45%;">Invoice Number</td>
                <td style="padding: 10px 18px; color: #222; font-weight: bold; font-size: 14px;">${mockInvoiceData.invoiceNumber}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eef1f5;">
                <td style="padding: 10px 18px; color: #666; font-size: 14px;">Packing List</td>
                <td style="padding: 10px 18px; color: #222; font-size: 14px;">${mockInvoiceData.packingListName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eef1f5;">
                <td style="padding: 10px 18px; color: #666; font-size: 14px;">Total Amount</td>
                <td style="padding: 10px 18px; color: #222; font-weight: bold; font-size: 14px;">${mockInvoiceData.currency} ${mockInvoiceData.totalAmount}</td>
              </tr>
              <tr>
                <td style="padding: 10px 18px; color: #666; font-size: 14px;">Due Date</td>
                <td style="padding: 10px 18px; color: #222; font-size: 14px;">${mockInvoiceData.dueDate}</td>
              </tr>
            </table>
          </div>
          <div style="margin: 0 30px 20px 30px; background-color: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 4px; padding: 14px 18px;">
            <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold; color: #2e7d32;">🔗 TEST LINKS - Click to verify they work:</p>
            <ul style="margin: 0; padding-left: 18px; color: #1b5e20; font-size: 13px; line-height: 2;">
              <li><a href="${invoiceUrl}" style="color: #1565c0;">View Invoice Online</a></li>
              <li><a href="${invoiceUrl}/pdf" style="color: #1565c0;">Download Invoice PDF</a></li>
            </ul>
          </div>
          <div style="text-align: center; margin: 20px 30px;">
            <a href="${invoiceUrl}" style="display: inline-block; padding: 12px 30px; background-color: #1a3c6e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View Invoice Online</a>
          </div>
          <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef; margin-top: 20px;">
            <p style="color: #adb5bd; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} AOSTP International Logistics - Test Email</p>
          </div>
        </div>
      `;

      console.log('');
      console.log('='.repeat(60));
      console.log('EMAIL NOTIFICATION TEST (REAL EMAIL)');
      console.log('='.repeat(60));
      console.log(`Email Provider: ${emailProvider.getName()}`);
      console.log(`Sending to: ${TEST_EMAIL}`);
      console.log(`Invoice URL: ${invoiceUrl}`);
      console.log(`Packing List: ${mockInvoiceData.packingListName}`);
      console.log('');

      const result = await emailProvider.sendEmail(
        TEST_EMAIL,
        `[TEST] Invoice Issued - ${mockInvoiceData.invoiceNumber}`,
        emailContent,
        { html: true },
      );

      console.log(`Email Send Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (result.messageId) {
        console.log(`Message ID: ${result.messageId}`);
      }
      if (result.error) {
        console.error(`Error: ${result.error}`);
      }
      console.log('='.repeat(60));
      console.log('');

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });

  describe('Summary', () => {
    it('should display test summary with all URLs', () => {
      const invoiceUrl = getPublicInvoiceUrl(mockInvoiceData.accessToken);
      
      console.log('');
      console.log('╔' + '═'.repeat(58) + '╗');
      console.log('║' + ' '.repeat(18) + 'TEST SUMMARY' + ' '.repeat(28) + '║');
      console.log('╠' + '═'.repeat(58) + '╣');
      console.log('║ Invoice Number: ' + mockInvoiceData.invoiceNumber.padEnd(41) + '║');
      console.log('║ Packing List: ' + mockInvoiceData.packingListName.padEnd(43) + '║');
      console.log('║ Test Email: ' + TEST_EMAIL.padEnd(45) + '║');
      console.log('║ Test Phone: ' + TEST_PHONE.padEnd(45) + '║');
      console.log('╠' + '═'.repeat(58) + '╣');
      console.log('║ URLS TO TEST:' + ' '.repeat(44) + '║');
      console.log('║' + ' '.repeat(58) + '║');
      console.log('║ View Invoice:' + ' '.repeat(44) + '║');
      console.log('║ ' + invoiceUrl.substring(0, 56).padEnd(57) + '║');
      console.log('║' + ' '.repeat(58) + '║');
      console.log('║ Download PDF:' + ' '.repeat(44) + '║');
      console.log('║ ' + (invoiceUrl + '/pdf').substring(0, 56).padEnd(57) + '║');
      console.log('╚' + '═'.repeat(58) + '╝');
      console.log('');
      console.log('To test with real invoice, replace accessToken with a real one from your database.');
      console.log('');
    });
  });
});
