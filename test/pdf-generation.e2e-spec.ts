import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PDFService, InvoiceData } from '../src/providers/pdf/pdf.service';
import { S3Service } from '../src/providers/storage/s3.service';
import * as fs from 'fs';
import * as path from 'path';

describe('PDF Generation E2E Test', () => {
  let service: PDFService;
  let outputDir: string;

  beforeAll(async () => {
    // Create output directory for generated PDFs
    outputDir = path.join(__dirname, 'pdf-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PDFService,
        {
          provide: ConfigService,
          useFactory: () => ({
            get: jest.fn((key: string) => {
              const config = {
                AWS_S3_BUCKET_NAME: 'test-bucket',
                COMPANY_NAME: 'AOSTP International Logistics',
                COMPANY_PHONE: '+233-24-123-4567',
                COMPANY_BRANCHES: 'Accra | Kumasi | Takoradi | Tema',
                COMPANY_EMAIL: 'info@aostp-logistics.com',
                COMPANY_ADDRESS: '123 Shipping Lane, Trade Zone, Accra',
                COMPANY_MOMO_NUMBER: '0241234567',
                COMPANY_MOMO_NAME: 'AOSTP LOGISTICS LTD',
              };
              return config[key];
            }),
            getOrThrow: jest.fn().mockReturnValue('test-bucket'),
          }),
        },
        {
          provide: S3Service,
          useFactory: () => ({
            uploadFileWithBucket: jest.fn().mockImplementation(
              async (bucket: string, key: string, buffer: Buffer) => {
                // Instead of uploading to S3, save to local file system for inspection
                const filename = key.replace(/\//g, '_');
                const filepath = path.join(outputDir, filename);
                fs.writeFileSync(filepath, buffer);
                console.log(`PDF saved to: ${filepath}`);
                return {
                  url: `file://${filepath}`,
                  key: key,
                };
              },
            ),
          }),
        },
      ],
    }).compile();

    service = module.get<PDFService>(PDFService);
  });

  afterAll(() => {
    console.log(`\n✅ Test PDFs generated in: ${outputDir}`);
  });

  describe('Invoice PDF Generation with Dummy Data', () => {
    it('should generate SEA shipping invoice with multiple items', async () => {
      const invoiceData: InvoiceData = {
        company: {
          name: 'AOSTP International Logistics',
          address: '123 Shipping Lane, Trade Zone, Accra, Ghana',
          phone: '+233-24-123-4567',
          email: 'info@aostp-logistics.com',
        },
        invoice: {
          number: 'INV-2026-SEA-00001',
          date: '2026-02-26',
          dueDate: '2026-04-15',
          status: 'PENDING',
          shippingRate: 35.50,
        },
        customer: {
          code: 'CUST-GH-001',
          name: 'KWAME NKRUMAH TRADING COMPANY',
          address: 'Plot 45, Independence Avenue, Kumasi, Ashanti Region',
          phone: '+233-50-987-6543',
          email: 'kwame.trading@example.com',
        },
        package: {
          trackingCode: 'PKG-SEA-2026-12345',
          description: 'Mixed electronics and household goods',
          shippingMode: 'SEA',
          quantity: 8,
          weightKg: 450.5,
          cbm: 3.75,
          shippingRate: 35.50,
          destinationCity: {
            id: 'city-kumasi',
            name: 'Kumasi',
            country: 'Ghana',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-02-26'),
          },
          warehouse: 'Tema Port Container Yard A',
          pickupCode: 'PICK-KMS-2026-789',
        },
        container: {
          number: 'CNTR-40HC-2026-567',
          loadingDate: '2026-03-01',
          origin: 'Guangzhou Port, China',
          destination: 'Tema Port, Ghana',
        },
        items: [
          {
            description: 'Samsung 55" Smart TV (QLED Series)',
            quantity: 2,
            unitPrice: 850.00,
            total: 1700.00,
          },
          {
            description: 'Laptop Computers - HP EliteBook (with accessories)',
            quantity: 3,
            unitPrice: 1200.00,
            total: 3600.00,
          },
          {
            description: 'Kitchen Appliance Set (Refrigerator, Microwave, Blender)',
            quantity: 1,
            unitPrice: 1500.00,
            total: 1500.00,
          },
          {
            description: 'Furniture Items - Office Desk and Ergonomic Chairs (3 pieces)',
            quantity: 3,
            unitPrice: 350.00,
            total: 1050.00,
          },
          {
            description: 'Clothing and Textiles (10 boxes assorted items)',
            quantity: 10,
            unitPrice: 75.00,
            total: 750.00,
          },
          {
            description: 'Children Toys and Educational Materials (5 boxes)',
            quantity: 5,
            unitPrice: 45.00,
            total: 225.00,
          },
        ],
        totals: {
          subtotal: 8825.00,
          tax: 0.00,
          total: 8825.00,
          paid: 2000.00,
          balance: 6825.00,
        },
        currency: 'USD',
        notes: 'Estimated arrival: Mid-April 2026. Please ensure payment is completed before collection.',
      };

      const result = await service.generateInvoicePDF(invoiceData);
      expect(result).toBeDefined();
      expect(result.key).toContain('INV-2026-SEA-00001');
    });

    it('should generate AIR EXPRESS shipping invoice', async () => {
      const invoiceData: InvoiceData = {
        company: {
          name: 'AOSTP Express Air Services',
          address: '456 Airport Road, Kotoka International Airport, Accra',
          phone: '+233-30-555-9999',
          email: 'express@aostp-air.com',
        },
        invoice: {
          number: 'INV-2026-AIR-EXPRESS-00025',
          date: '2026-02-26',
          dueDate: '2026-03-03',
          status: 'PAID',
          shippingRate: 185.00,
        },
        customer: {
          code: 'CUST-VIP-025',
          name: 'Dr. Ama Osei-Bonsu',
          address: 'Executive Heights, East Legon, Accra',
          phone: '+233-54-222-3333',
          email: 'dr.ama.osei@medicalcorp.com',
        },
        package: {
          trackingCode: 'AIR-EXP-2026-99999',
          description: 'Urgent medical equipment and supplies',
          shippingMode: 'AIR',
          airType: 'EXPRESS_AIR',
          quantity: 1,
          weightKg: 28.5,
          shippingRate: 185.00,
          destinationCity: {
            id: 'city-accra',
            name: 'Accra',
            country: 'Ghana',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-02-26'),
          },
          warehouse: 'Airport Cargo Terminal - Express Section',
          pickupCode: 'EXP-URGENT-ACC-333',
        },
        items: [
          {
            description: 'Medical Diagnostic Equipment (Portable Ultrasound Scanner)',
            quantity: 1,
            unitPrice: 4500.00,
            total: 4500.00,
          },
          {
            description: 'Surgical Instruments Kit (Sterilized, sealed packaging)',
            quantity: 1,
            unitPrice: 1200.00,
            total: 1200.00,
          },
        ],
        totals: {
          subtotal: 5700.00,
          total: 5700.00,
          paid: 5700.00,
          balance: 0.00,
        },
        currency: 'USD',
        notes: 'EXPRESS DELIVERY - Ready for pickup within 24 hours of arrival. Priority handling.',
      };

      const result = await service.generateInvoicePDF(invoiceData);
      expect(result).toBeDefined();
      expect(result.key).toContain('INV-2026-AIR-EXPRESS-00025');
    });

    it('should generate AIR NORMAL shipping invoice with single large item', async () => {
      const invoiceData: InvoiceData = {
        company: {
          name: 'AOSTP Cargo Services',
          address: 'Cargo Complex, Kotoka Airport, Accra, Ghana',
          phone: '+233-24-777-8888',
          email: 'cargo@aostp.com',
        },
        invoice: {
          number: 'INV-2026-AIR-456',
          date: '2026-02-26',
          dueDate: '2026-03-12',
          status: 'PENDING',
          shippingRate: 95.00,
        },
        customer: {
          code: 'CUST-TKD-123',
          name: 'Kofi Mensah Enterprise',
          address: 'Market Circle Road, Takoradi, Western Region',
          phone: '+233-31-444-5555',
          email: 'kofi.mensah@business.gh',
        },
        package: {
          trackingCode: 'PKG-AIR-2026-78901',
          description: 'Industrial printer and supplies',
          shippingMode: 'AIR',
          airType: 'NORMAL_AIR',
          quantity: 1,
          weightKg: 65.0,
          shippingRate: 95.00,
          destinationCity: {
            id: 'city-takoradi',
            name: 'Takoradi',
            country: 'Ghana',
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-02-26'),
          },
          warehouse: 'Airport Warehouse B',
          pickupCode: 'PICK-TKD-567',
        },
        totals: {
          subtotal: 2800.00,
          total: 2800.00,
          paid: 0.00,
          balance: 2800.00,
        },
        currency: 'USD',
        notes: 'Handle with care - fragile equipment. Full payment required before release.',
      };

      const result = await service.generateInvoicePDF(invoiceData);
      expect(result).toBeDefined();
      expect(result.key).toContain('INV-2026-AIR-456');
    });

    it('should generate invoice with very long customer name and descriptions', async () => {
      const invoiceData: InvoiceData = {
        company: {
          name: 'AOSTP',
          address: '123 Main St, Accra',
          phone: '+233-24-000-0000',
          email: 'test@aostp.com',
        },
        invoice: {
          number: 'INV-2026-LONG-TEXT-TEST',
          date: '2026-02-26',
          dueDate: '2026-03-26',
          status: 'PENDING',
          shippingRate: 50.00,
        },
        customer: {
          code: 'CUST-LONG-NAME',
          name: 'KWABENA OSEI-TUTU MENSAH INTERNATIONAL TRADING AND LOGISTICS COMPANY LIMITED',
          address: 'Building 45, Industrial Area Phase II, Extended Commercial Zone',
          phone: '+233-50-123-456-789',
          email: 'very.long.email.address@international-trading-company.com',
        },
        package: {
          trackingCode: 'PKG-LONG-DESC-2026-001',
          description:
            'This is a very long package description that includes multiple items such as electronics, furniture, clothing, toys, books, and various household goods that need to fit properly on the PDF without overflowing',
          shippingMode: 'SEA',
          quantity: 15,
          weightKg: 850.0,
          cbm: 8.5,
          shippingRate: 50.00,
          destinationCity: {
            id: 'city-1',
            name: 'Kumasi',
            country: 'Ghana',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          pickupCode: 'LONG-PICKUP-CODE-12345',
        },
        items: [
          {
            description:
              'Super long item description that tests the wrapping capability of the PDF generation - High-end Gaming Laptop with 32GB RAM, 1TB SSD, RTX Graphics Card, and Extended Warranty (International Version with accessories)',
            quantity: 1,
            unitPrice: 2500.00,
            total: 2500.00,
          },
        ],
        totals: {
          total: 2500.00,
        },
        currency: 'USD',
      };

      const result = await service.generateInvoicePDF(invoiceData);
      expect(result).toBeDefined();
      expect(result.key).toContain('INV-2026-LONG-TEXT-TEST');
    });

    it('should generate multi-page invoice when items overflow a single page', async () => {
      const manyItems = Array.from({ length: 20 }, (_, i) => ({
        description: `Item ${i + 1}: Various goods batch #${i + 1} - electronics, clothing, accessories`,
        quantity: i + 1,
        unitPrice: 50 + i * 10,
        total: (i + 1) * (50 + i * 10),
      }));

      const invoiceData: InvoiceData = {
        company: {
          name: 'AOSTP International Logistics',
          address: '123 Shipping Lane, Accra',
          phone: '+233-24-123-4567',
          email: 'info@aostp.com',
        },
        invoice: {
          number: 'INV-2026-MULTIPAGE-001',
          date: '2026-02-26',
          dueDate: '2026-03-26',
          status: 'PENDING',
          shippingRate: 45.0,
        },
        customer: {
          code: 'CUST-MULTI-001',
          name: 'KWAME ASANTE BOATENG',
          address: 'Kanda Estate, Accra',
          phone: '+233-20-987-6543',
          email: 'kwame@example.com',
        },
        package: {
          trackingCode: 'PKG-MULTI-2026-001',
          description: 'Mixed goods shipment',
          shippingMode: 'SEA',
          quantity: 20,
          cbm: 12.5,
          shippingRate: 45.0,
          destinationCity: {
            id: 'city-1',
            name: 'Accra',
            country: 'Ghana',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          pickupCode: 'MULTI-PICKUP-001',
        },
        items: manyItems,
        totals: {
          subtotal: manyItems.reduce((s, it) => s + it.total, 0),
          total: manyItems.reduce((s, it) => s + it.total, 0),
          paid: 0,
          balance: manyItems.reduce((s, it) => s + it.total, 0),
        },
        currency: 'USD',
      };

      const result = await service.generateInvoicePDF(invoiceData);
      expect(result).toBeDefined();
      expect(result.key).toContain('INV-2026-MULTIPAGE-001');
      console.log('Multi-page invoice PDF saved — check test/pdf-output for payment notice on last page');
    });
  });
});
