#!/usr/bin/env ts-node

/**
 * Script to generate sample invoice PDFs with dummy data
 * Usage: npm run generate-sample-pdfs
 * or: npx ts-node scripts/generate-sample-pdfs.ts
 */

import { PDFService, InvoiceData } from '../src/providers/pdf/pdf.service';
import { S3Service } from '../src/providers/storage/s3.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

class MockS3Service {
  async uploadFileWithBucket(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ) {
    const outputDir = path.join(__dirname, '..', 'sample-pdfs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = key.replace(/\//g, '_');
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, buffer);
    console.log(`✅ PDF saved to: ${filepath}`);

    return {
      url: `file://${filepath}`,
      key: key,
    };
  }
}

class MockConfigService {
  getOrThrow(key: string) {
    return 'sample-bucket';
  }
}

async function generateSamplePDFs() {
  console.log('🚀 Starting PDF generation...\n');

  const pdfService = new PDFService(
    new MockConfigService() as ConfigService,
    new MockS3Service() as unknown as S3Service,
  );

  // Sample 1: SEA Shipping Invoice
  console.log('📄 Generating SEA shipping invoice...');
  const seaInvoice: InvoiceData = {
    company: {
      name: 'AOSTP International Logistics',
      address: '123 Shipping Lane, Accra, Ghana',
      phone: '+233-24-123-4567',
      email: 'info@aostp.com',
    },
    invoice: {
      number: 'INV-2026-SEA-00123',
      date: '2026-02-26',
      dueDate: '2026-04-15',
      status: 'PENDING',
      shippingRate: 35.50,
    },
    customer: {
      code: 'CUST-001',
      name: 'KWAME TRADING COMPANY',
      address: 'Plot 45, Kumasi, Ghana',
      phone: '+233-50-987-6543',
      email: 'kwame@trading.com',
    },
    package: {
      trackingCode: 'PKG-SEA-2026-12345',
      description: 'Mixed electronics and household goods',
      shippingMode: 'SEA',
      quantity: 5,
      weightKg: 450.5,
      cbm: 3.75,
      shippingRate: 35.50,
      destinationCity: {
        id: 'city-kms',
        name: 'Kumasi',
        country: 'Ghana',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      warehouse: 'Tema Port Container Yard',
      pickupCode: 'PICK-KMS-789',
    },
    items: [
      {
        description: 'Samsung 55" Smart TV',
        quantity: 2,
        unitPrice: 850.0,
        total: 1700.0,
      },
      {
        description: 'Laptop Computers - HP EliteBook',
        quantity: 3,
        unitPrice: 1200.0,
        total: 3600.0,
      },
      {
        description: 'Kitchen Appliances',
        quantity: 1,
        unitPrice: 1500.0,
        total: 1500.0,
      },
    ],
    totals: {
      subtotal: 6800.0,
      total: 6800.0,
      paid: 2000.0,
      balance: 4800.0,
    },
    currency: 'USD',
  };

  await pdfService.generateInvoicePDF(seaInvoice);

  // Sample 2: AIR EXPRESS Invoice
  console.log('📄 Generating AIR EXPRESS invoice...');
  const airExpressInvoice: InvoiceData = {
    company: {
      name: 'AOSTP Express Air Services',
      address: '456 Airport Road, Accra, Ghana',
      phone: '+233-30-555-9999',
      email: 'express@aostp.com',
    },
    invoice: {
      number: 'INV-2026-AIR-EXPRESS-025',
      date: '2026-02-26',
      dueDate: '2026-03-03',
      status: 'PAID',
      shippingRate: 185.0,
    },
    customer: {
      code: 'CUST-VIP-025',
      name: 'Dr. Ama Osei-Bonsu',
      phone: '+233-54-222-3333',
      email: 'ama.osei@email.com',
    },
    package: {
      trackingCode: 'AIR-EXP-2026-999',
      description: 'Urgent business documents',
      shippingMode: 'AIR',
      airType: 'EXPRESS_AIR',
      quantity: 1,
      weightKg: 28.5,
      shippingRate: 185.0,
      destinationCity: {
        id: 'city-acc',
        name: 'Accra',
        country: 'Ghana',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      pickupCode: 'EXP-ACC-333',
    },
    totals: {
      total: 5700.0,
      paid: 5700.0,
      balance: 0.0,
    },
    currency: 'USD',
  };

  await pdfService.generateInvoicePDF(airExpressInvoice);

  // Sample 3: AIR NORMAL Invoice
  console.log('📄 Generating AIR NORMAL invoice...');
  const airNormalInvoice: InvoiceData = {
    company: {
      name: 'AOSTP Cargo Services',
      address: 'Airport Complex, Accra, Ghana',
      phone: '+233-24-777-8888',
      email: 'cargo@aostp.com',
    },
    invoice: {
      number: 'INV-2026-AIR-456',
      date: '2026-02-26',
      dueDate: '2026-03-12',
      status: 'PENDING',
      shippingRate: 95.0,
    },
    customer: {
      code: 'CUST-123',
      name: 'Kofi Mensah Enterprise',
      phone: '+233-31-444-5555',
      email: 'kofi@business.gh',
    },
    package: {
      trackingCode: 'PKG-AIR-2026-789',
      description: 'Industrial printer',
      shippingMode: 'AIR',
      airType: 'NORMAL_AIR',
      quantity: 1,
      weightKg: 65.0,
      shippingRate: 95.0,
      destinationCity: {
        id: 'city-tkd',
        name: 'Takoradi',
        country: 'Ghana',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      pickupCode: 'PICK-TKD-567',
    },
    totals: {
      total: 2800.0,
      balance: 2800.0,
    },
    currency: 'USD',
  };

  await pdfService.generateInvoicePDF(airNormalInvoice);

  console.log(
    '\n✨ All sample PDFs generated successfully in sample-pdfs/ directory!',
  );
}

// Run the script
generateSamplePDFs().catch((error) => {
  console.error('❌ Error generating PDFs:', error);
  process.exit(1);
});
