#!/usr/bin/env node

/**
 * Direct test of Hubtel provider with real API calls
 * Tests the HubtelProvider directly without going through payment service
 */

const { HubtelProvider } = require('./src/providers/payment-gateway/providers/hubtel.provider');
const { ConfigService } = require('@nestjs/config');

// Mock ConfigService to provide Hubtel credentials
class MockConfigService {
  get(key, defaultValue = '') {
    const envVars = {
      // Hubtel configuration - replace with your real credentials
      'HUBTEL_BASE_URL': 'https://invoiving.hubtel.com',
      'HUBTEL_POS_SALES_ID': 'POS123', // Your POS sales ID
      'HUBTEL_USERNAME': 'your-hubtel-username', // Your Hubtel username
      'HUBTEL_PASSWORD': 'your-hubtel-password', // Your Hubtel password
      'HUBTEL_API_KEY': 'your-api-key', // Your API key if required
    };

    return process.env[key] || envVars[key] || defaultValue;
  }
}

async function testHubtelProvider() {
  console.log('🧪 Testing Hubtel Provider Directly');
  console.log('==================================\n');

  // Create provider instance
  const configService = new MockConfigService();
  const provider = new HubtelProvider(configService);

  // Test payment data
  const testPaymentData = {
    amount: 10.00, // Small test amount
    currency: 'GHS',
    customerEmail: 'test@example.com',
    customerPhone: '+233501234567',
    customerName: 'Test Customer',
    reference: `TEST-${Date.now()}`,
    description: 'Direct Hubtel Provider Test Payment',
    metadata: {
      testId: 'direct-test-001',
    },
  };

  console.log('📤 Test Payment Data:');
  console.log(JSON.stringify(testPaymentData, null, 2));
  console.log('');

  try {
    console.log('🚀 Calling Hubtel API...');

    const startTime = Date.now();
    const result = await provider.processPayment(testPaymentData);
    const duration = Date.now() - startTime;

    console.log(`⏱️  API Response Time: ${duration}ms\n`);

    console.log('📊 Hubtel API Response:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    if (result.success) {
      console.log('✅ SUCCESS: Hubtel API accepted the payment request!');
      console.log(`🔗 Invoice ID: ${result.gatewayTransactionId}`);
      console.log(`💰 Status: ${result.status}`);

      if (result.paymentUrl) {
        console.log(`📱 Payment URL: ${result.paymentUrl}`);
        console.log('\n💡 Visit the payment URL above to complete the payment');
      }

      if (result.gatewayResponse) {
        console.log('\n🔍 Full Hubtel Response:');
        console.log(JSON.stringify(result.gatewayResponse, null, 2));
      }

    } else {
      console.log('❌ FAILED: Hubtel API rejected the payment request');
      console.log(`💥 Error: ${result.errorMessage}`);

      if (result.gatewayResponse) {
        console.log('🔍 Hubtel Error Response:');
        console.log(JSON.stringify(result.gatewayResponse, null, 2));
      }
    }

  } catch (error) {
    console.log('💥 EXCEPTION: Error calling Hubtel API');
    console.log(`Error Type: ${error.constructor.name}`);
    console.log(`Error Message: ${error.message}`);

    if (error.response) {
      console.log(`HTTP Status: ${error.response.status}`);
      console.log('Response Headers:', error.response.headers);
      console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.code) {
      console.log(`Network Error Code: ${error.code}`);
    }
  }

  console.log('\n==================================');
  console.log('🏁 Direct Hubtel Provider Test Complete');
}

// Additional test for getting payment status
async function testPaymentStatus() {
  console.log('\n🔍 Testing Payment Status Check');
  console.log('=================================');

  const configService = new MockConfigService();
  const provider = new HubtelProvider(configService);

  const testTransactionId = 'INV-TEST-123'; // Replace with real invoice ID from successful payment

  try {
    console.log(`Checking status for: ${testTransactionId}`);

    const startTime = Date.now();
    const status = await provider.getPaymentStatus(testTransactionId);
    const duration = Date.now() - startTime;

    console.log(`⏱️  Status Check Time: ${duration}ms`);
    console.log(`📊 Payment Status: ${status}`);

  } catch (error) {
    console.log('❌ Status check failed:');
    console.log(`Error: ${error.message}`);
  }
}

// Environment variables help
function showHelp() {
  console.log(`
🧪 Direct Hubtel Provider Test
==============================

This script tests the HubtelProvider directly with real API calls.

Required Environment Variables:
  HUBTEL_POS_SALES_ID    Your Hubtel POS sales ID
  HUBTEL_USERNAME        Your Hubtel username
  HUBTEL_PASSWORD        Your Hubtel password
  HUBTEL_API_KEY         Your Hubtel API key (if required)

Usage:
  # Set environment variables
  export HUBTEL_POS_SALES_ID="your-pos-id"
  export HUBTEL_USERNAME="your-username"
  export HUBTEL_PASSWORD="your-password"
  export HUBTEL_API_KEY="your-api-key"

  # Run the test
  node test-hubtel-direct.js

What it tests:
- Hubtel API connectivity
- Invoice creation (pay-at-once endpoint)
- Error handling
- Response parsing

Expected Results:
- SUCCESS: Payment URL and invoice ID returned
- FAILED: Error message explaining what went wrong

The test makes a real API call to Hubtel, so ensure:
1. Your credentials are valid
2. You have sufficient balance for test payments
3. Network connectivity to Hubtel API

⚠️  WARNING: This creates real transactions on Hubtel!
  `);
}

// Run the test
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

async function main() {
  try {
    await testHubtelProvider();

    // Uncomment to also test status checking
    // await testPaymentStatus();

  } catch (error) {
    console.error('💥 Unhandled error in main():', error);
  }
}

main();
