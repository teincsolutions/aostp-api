const PDFDocument = require('pdfkit');
const { PDFService, InvoiceData, ReceiptData } = require('./dist/providers/pdf/pdf.service');
const { ConfigService } = require('@nestjs/config');
const fs = require('fs');

// Mock ConfigService
const mockConfigService = {
  getOrThrow: (key) => {
    if (key === 'AWS_PACKAGES_BUCKET_NAME') return 'test-bucket';
    throw new Error(`Config key ${key} not found`);
  }
};

// Mock S3Service that saves to local file instead of uploading
const mockS3Service = {
  uploadFileWithBucket: async (bucket, key, buffer, contentType) => {
    const filename = key.replace(/\//g, '_').replace(/\..*/, '.pdf');
    fs.writeFileSync(filename, buffer);
    console.log(`Saved PDF to: ${filename}`);
    return { url: `file://${filename}`, key };
  }
};

// Create service instance with mocks
class StubPDFService extends PDFService {
  constructor() {
    super(mockConfigService, mockS3Service);
  }
}

async function generateExamples() {
  console.log('Generating example PDFs...');

  const service = new StubPDFService();

  // Example invoice data
  const invoiceData = {
    company: {
      name: 'AOSTP Logistics Company',
      address: '123 Accra Street, Ghana',
      phone: '+233 20 123 4567',
      email: 'info@aostp.com',
    },
    invoice: {
      number: 'INV-2025-001',
      date: '2025-10-16',
      dueDate: '2025-10-30',
      status: 'pending',
    },
    customer: {
      code: 'CUST-001',
      name: 'John Smith',
      phone: '+1 555-0123',
      email: 'john.smith@email.com',
    },
    package: {
      trackingCode: 'TRACK-AO-2025-001',
      description: 'Electronics Shipment',
      shippingMode: 'AIR',
      airType: 'NORMAL_AIR',
      quantity: 2,
      weightKg: 5,
      cbm: 0.02,
      destinationCity: 'New York',
      warehouse: 'Tema Central',
    },
    totals: {
      subtotal: 150.00,
      tax: 15.00,
      total: 165.00,
    },
    currency: 'USD',
  };

  // Example receipt data
  const receiptData = {
    company: {
      name: 'AOSTP Logistics Company',
      address: '123 Accra Street, Ghana',
      phone: '+233 20 123 4567',
      email: 'info@aostp.com',
    },
    receipt: {
      number: 'RCT-2025-001',
      date: '2025-10-16',
      paymentMethod: 'MoMo Payment',
    },
    customer: {
      code: 'CUST-001',
      name: 'John Smith',
      phone: '+1 555-0123',
      email: 'john.smith@email.com',
    },
    payment: {
      amount: 165.00,
      currency: 'USD',
    },
    invoices: [
      {
        number: 'INV-2025-001',
        total: 165.00,
        paid: 165.00,
        balance: 0.00,
      },
    ],
    package: {
      trackingCode: 'TRACK-AO-2025-001',
      description: 'Electronics Shipment',
      shippingMode: 'AIR',
      airType: 'NORMAL_AIR',
      quantity: 2,
      weightKg: 5,
      cbm: 0.02,
      destinationCity: 'New York',
      warehouse: 'Tema Central',
    },
  };

  try {
    console.log('Generating invoice PDF...');
    const invoiceResult = await service.generateInvoicePDF(invoiceData);
    console.log('Invoice generated:', invoiceResult);

    console.log('Generating receipt PDF...');
    const receiptResult = await service.generateReceiptPDF(receiptData);
    console.log('Receipt generated:', receiptResult);

    console.log('\n✅ Example PDFs generated successfully!');
    console.log('Check the files:');
    console.log('- invoices_invoice-INV-2025-001.pdf');
    console.log('- receipts_receipt-RCT-2025-001.pdf');

  } catch (error) {
    console.error('❌ Error generating PDFs:', error);
  }
}

// Run the generator
generateExamples();
