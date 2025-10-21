#!/usr/bin/env node

/**
 * Test script for Hubtel mobile money payment integration
 * This script tests the complete payment flow with real Hubtel API
 */

const axios = require('axios');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// You'll need to set these environment variables or replace with real values
const TEST_TOKEN = process.env.TEST_JWT_TOKEN || 'your-jwt-token-here';
const TEST_CUSTOMER_ID = process.env.TEST_CUSTOMER_ID || 'your-customer-id-here';
const TEST_INVOICE_IDS = process.env.TEST_INVOICE_IDS ? JSON.parse(process.env.TEST_INVOICE_IDS) : ['your-invoice-id-here'];
const TEST_EXCHANGE_RATE_ID = process.env.TEST_EXCHANGE_RATE_ID || 'your-exchange-rate-id-here';

async function loginForToken() {
  try {
    console.log('🔑 Logging in to get authentication token...');

    // You'll need to modify these credentials based on your auth setup
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: process.env.TEST_EMAIL || 'admin@example.com',
      password: process.env.TEST_PASSWORD || 'password123',
    });

    return loginResponse.data.access_token;
  } catch (error) {
    console.log('❌ Could not login automatically. Using provided TEST_TOKEN...');
    return TEST_TOKEN;
  }
}

async function createTestPayment(token) {
  console.log('💰 Creating mobile money payment...');

  const paymentData = {
    customerId: TEST_CUSTOMER_ID,
    amount: 50.00,
    currency: 'GHS',
    exchangeRateId: TEST_EXCHANGE_RATE_ID,
    paymentMethod: 'MOBILE_MONEY',
    reference: `TEST-HUBTEL-${Date.now()}`,
    invoiceIds: TEST_INVOICE_IDS,
    notes: 'Test payment for Hubtel integration'
  };

  try {
    const response = await axios.post(`${BASE_URL}/payments`, paymentData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Payment creation response:');
    console.log(JSON.stringify(response.data, null, 2));

    const payment = response.data;

    // Check if payment was created with gateway integration
    if (payment.notes && payment.notes.includes('GATEWAY PAYMENT URL')) {
      console.log('🎉 Gateway URL found in notes - integration working!');
      console.log('📱 Payment URL:', payment.notes.match(/GATEWAY PAYMENT URL: ([^\n]+)/)?.[1]);
    }

    if (payment.notes && payment.notes.includes('GATEWAY TRANSACTION ID')) {
      console.log('🔗 Gateway Transaction ID found!');
      console.log('🆔 Transaction ID:', payment.notes.match(/GATEWAY TRANSACTION ID: ([^\n]+)/)?.[1]);
    }

    // Check for intended invoices
    if (payment.notes && payment.notes.includes('INTENDED INVOICES')) {
      console.log('📑 Intended invoices stored for later processing');
    }

    return payment;

  } catch (error) {
    console.log('❌ Payment creation failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
    throw error;
  }
}

async function checkPaymentStatus(token, paymentId) {
  console.log('🔍 Checking payment status...');

  try {
    const response = await axios.get(`${BASE_URL}/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Current payment status:');
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;

  } catch (error) {
    console.log('❌ Could not check payment status:');
    console.log('Error:', error.message);
    return null;
  }
}

async function testHubtelCallback(paymentCode) {
  console.log('🔄 Testing Hubtel callback...');

  // This simulates what Hubtel would send when payment succeeds
  const callbackData = {
    Status: 'Successful',
    Data: {
      CheckoutId: paymentCode,
      ReceiptNumber: `REC-${Date.now()}`,
      Description: 'Mobile money payment successful'
    }
  };

  try {
    const response = await axios.post(`${BASE_URL}/payments/hubtel/callback`, callbackData);

    console.log('✅ Callback response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('❌ Callback failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

async function main() {
  console.log('🧪 Testing Hubtel Mobile Money Payment Integration');
  console.log('================================================\n');

  try {
    // Step 1: Login to get token
    const token = await loginForToken();
    console.log('✅ Authentication successful\n');

    // Step 2: Create a mobile money payment
    const payment = await createTestPayment(token);

    // Step 3: Check initial payment status
    await checkPaymentStatus(token, payment.id);

    // Step 4: Wait a moment, then simulate successful callback
    if (payment.paymentCode) {
      console.log('\n⏳ Simulating successful payment callback...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      await testHubtelCallback(payment.paymentCode);

      // Step 5: Check final payment status
      await checkPaymentStatus(token, payment.id);
    }

    console.log('\n🎉 Hubtel integration test completed!');
    console.log('================================================');

  } catch (error) {
    console.log('\n💥 Test failed with error:', error.message);
    process.exit(1);
  }
}

// Show usage information
function showUsage() {
  console.log(`
🧪 Hubtel Payment Integration Test
==================================

Usage: node test-hubtel-payment.js

Environment Variables:
  BASE_URL=http://localhost:3000           # API base URL
  TEST_EMAIL=admin@example.com             # Admin email for login
  TEST_PASSWORD=password123                # Admin password
  TEST_CUSTOMER_ID=<customer-id>           # Valid customer ID
  TEST_INVOICE_IDS=["inv-1","inv-2"]      # Valid invoice IDs (JSON array)
  TEST_EXCHANGE_RATE_ID=<exchange-id>      # Valid exchange rate ID
  TEST_JWT_TOKEN=<jwt-token>               # Pre-authenticated JWT token

Make sure your API server is running before executing this test.

The test will:
1. Authenticate with the API
2. Create a mobile money payment (should initiate with Hubtel)
3. Check payment status
4. Simulate successful callback
5. Verify payment was applied to invoices

Example:
  BASE_URL=http://localhost:3000 \\
  TEST_EMAIL=admin@example.com \\
  TEST_PASSWORD=password123 \\
  TEST_CUSTOMER_ID="123e4567-e89b-12d3-a456-426614174000" \\
  TEST_INVOICE_IDS='["123e4567-e89b-12d3-a456-426614174001"]' \\
  TEST_EXCHANGE_RATE_ID="123e4567-e89b-12d3-a456-426614174002" \\
  node test-hubtel-payment.js
  `);
}

// Check if help is requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run the test
main().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
