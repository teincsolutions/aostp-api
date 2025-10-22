#!/usr/bin/env node

/**
 * Test script for Hubtel callback processing
 * Tests the callback endpoints with the exact formats provided by the user
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testSuccessfulCallback() {
  console.log('🧪 Testing SUCCESSFUL Hubtel Callback');
  console.log('=====================================\n');

  // Use the exact successful callback format you provided
  const callbackData = {
    "ResponseCode": "0000",
    "Data": {
      "AmountDebited": 0.8,
      "TransactionId": "TEST-SUCCESSFUL-123",
      "ExternalTransactionId": "EXTERNAL-ID-123",
      "Description": "Vodafone cash payment has been made successfully",
      "ClientReference": "client-ref-123",
      "Amount": 0.8,
      "Charges": 0.010,
      "Meta": null,
      "RecipientName": "Joe Doe"
    }
  };

  try {
    console.log('📤 Sending successful callback...');
    const response = await axios.post(`${BASE_URL}/payments/hubtel/callback`, callbackData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Callback accepted:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

  } catch (error) {
    console.log('❌ Callback failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
    console.log('');
  }
}

async function testFailedCallback() {
  console.log('🧪 Testing FAILED Hubtel Callback');
  console.log('=================================\n');

  // Use the exact failed callback format you provided
  const callbackData = {
    "ResponseCode": "4075",
    "Data": {
      "AmountDebited": 0.8,
      "TransactionId": "TEST-FAILED-456",
      "ExternalTransactionId": null,
      "Description": "Insufficient prepaid balance.",
      "ClientReference": "client-ref-456",
      "Amount": 0.8,
      "Charges": 0.010,
      "Meta": null,
      "RecipientName": null
    }
  };

  try {
    console.log('📤 Sending failed callback...');
    const response = await axios.post(`${BASE_URL}/payments/hubtel/callback`, callbackData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Callback accepted:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

  } catch (error) {
    console.log('❌ Callback failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
    console.log('');
  }
}

async function testPendingCallback() {
  console.log('🧪 Testing PENDING Hubtel Callback (ResponseCode 0001)');
  console.log('=====================================================\n');

  // Test the pending/accepted response
  const callbackData = {
    "ResponseCode": "0001",
    "Data": {
      "AmountDebited": 0.0,
      "TransactionId": "TEST-PENDING-789",
      "Description": "Your request has been accepted. We will notify you when the transaction is completed.",
      "ClientReference": "client-ref-789",
      "ExternalTransactionId": "",
      "Amount": 0.8,
      "Charges": 0.0,
      "Meta": null,
      "RecipientName": null
    }
  };

  try {
    console.log('📤 Sending pending callback...');
    const response = await axios.post(`${BASE_URL}/payments/hubtel/callback`, callbackData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Callback accepted:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

  } catch (error) {
    console.log('❌ Callback failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
    console.log('');
  }
}

async function testUnknownCallback() {
  console.log('🧪 Testing UNKNOWN Hubtel Callback (ResponseCode 9999)');
  console.log('=====================================================\n');

  // Test an unknown response code
  const callbackData = {
    "ResponseCode": "9999",
    "Data": {
      "TransactionId": "TEST-UNKNOWN-999",
      "Description": "Unknown response code"
    }
  };

  try {
    console.log('📤 Sending unknown callback...');
    const response = await axios.post(`${BASE_URL}/payments/hubtel/callback`, callbackData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Callback accepted (should still acknowledge):');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

  } catch (error) {
    console.log('❌ Callback failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
    console.log('');
  }
}

// Main test runner
async function main() {
  console.log('🧪 Testing Hubtel Callback Processing');
  console.log('=====================================\n');

  console.log('Prerequisites: Make sure you have mobile money payments in your system!');
  console.log('The callbacks use TransactionId to lookup payments in the database.\n');

  // Show usage info
  console.log('Testing callback data formats based on your provided examples:\n');

  try {
    await testSuccessfulCallback(); // Should process payment and update invoices
    await testFailedCallback();     // Should mark payment as failed
    await testPendingCallback();    // Should be accepted but no action taken
    await testUnknownCallback();    // Should be acknowledged but logged as unknown

  } catch (error) {
    console.error('❌ Overall test error:', error.message);
  }

  console.log('🎉 Callback testing complete!');
}

// Show help
function showHelp() {
  console.log(`
🧪 Hubtel Callback Testing Script
=================================

This script tests Hubtel callback processing using the exact data formats you provided.

Usage:
  export BASE_URL=http://localhost:3000
  node test-hubtel-callback.js

What it tests:
- Successful payment callback (0000) - should apply payment to invoices
- Failed payment callback (4075+) - should mark payment as failed
- Pending payment callback (0001) - should be accepted but no action
- Unknown response codes - should be acknowledged but logged

Expected Results:
- All callbacks should return { status: "success" } to acknowledge receipt
- The system should process payments based on ResponseCode
- TransactionId in Data should match stored payment codes
  `);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Run tests
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
