import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import { PDFService, InvoiceData, ReceiptData } from './pdf.service';
import { S3Service } from '../storage/s3.service';

describe('PDFService', () => {
  let service: PDFService;
  let configService: jest.Mocked<ConfigService>;
  let s3Service: jest.Mocked<S3Service>;

  beforeEach(async function () {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PDFService,
        {
          provide: ConfigService,
          useFactory: () => ({
            get: jest.fn((key: string) => {
              const config = {
                AWS_S3_BUCKET_NAME: 'test-bucket',
                COMPANY_NAME: 'AOSTP Test Company',
                COMPANY_PHONE: '053 777 6709',
                COMPANY_BRANCHES: 'Accra | Kumasi | Takoradi',
                COMPANY_EMAIL: 'info@aostp.com',
                COMPANY_ADDRESS: '123 Test Street, Accra',
                COMPANY_MOMO_NUMBER: '0537776709',
                COMPANY_MOMO_NAME: 'AOSTP LTD',
              };
              return config[key];
            }),
            getOrThrow: jest.fn().mockReturnValue('test-bucket'),
          }),
        },
        {
          provide: S3Service,
          useFactory: () => ({
            uploadFileWithBucket: jest.fn().mockResolvedValue({
              url: 'mock-url',
              key: 'mock-key',
            }),
          }),
        },
      ],
    }).compile();

    service = module.get<PDFService>(PDFService);
    configService = module.get(ConfigService);
    s3Service = module.get(S3Service);
  });

  it('should be defined', function () {
    expect(service).toBeDefined();
  });

  describe('generateInvoicePDF', () => {
    it('should generate invoice PDF without error', async function (): Promise<void> {
      const invoiceData: InvoiceData = {
        company: {
          name: 'Test Company',
          address: '123 Test St',
          phone: '123-456-7890',
          email: 'test@example.com',
        },
        invoice: {
          number: 'INV-001',
          date: '2023-10-01',
          dueDate: '2023-10-15',
          status: 'pending',
        },
        customer: {
          code: 'CUST-001',
          name: 'John Doe',
          phone: '098-765-4321',
          email: 'john@example.com',
        },
        package: {
          trackingCode: 'TRACK-001',
          description: 'Test Package',
          shippingMode: 'AIR',
          quantity: 1,
        },
        totals: {
          subtotal: 100,
          tax: 10,
          total: 110,
        },
        currency: 'USD',
      };

      await service.generateInvoicePDF(invoiceData);
    });

    it('should generate comprehensive invoice PDF with dummy data', async function (): Promise<void> {
      const invoiceData: InvoiceData = {
        company: {
          name: 'AOSTP Logistics Ltd',
          address: '123 Main Street, Accra, Ghana',
          phone: '+233-24-123-4567',
          email: 'info@aostp.com',
        },
        invoice: {
          number: 'INV-2026-00123',
          date: '2026-02-26',
          dueDate: '2026-03-15',
          status: 'PENDING',
          shippingRate: 45.50,
        },
        customer: {
          code: 'CUST-001',
          name: 'John Kwame Mensah',
          address: 'P.O. Box 123, Kumasi, Ghana',
          phone: '+233-50-987-6543',
          email: 'john.mensah@email.com',
        },
        package: {
          trackingCode: 'PKG-2026-00456',
          description: 'Electronics and household items',
          shippingMode: 'SEA',
          quantity: 3,
          weightKg: 125.5,
          cbm: 2.5,
          shippingRate: 45.50,
          destinationCity: {
            id: 'city-1',
            name: 'Kumasi',
            country: 'Ghana',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          warehouse: 'Main Warehouse - Accra',
          pickupCode: 'PICK-2026-789',
        },
        items: [
          {
            description: 'Laptop Computer - Dell XPS 15',
            quantity: 1,
            unitPrice: 1200.00,
            total: 1200.00,
          },
          {
            description: 'Kitchen Appliances Set (Blender, Mixer, Toaster)',
            quantity: 1,
            unitPrice: 350.00,
            total: 350.00,
          },
          {
            description: 'Clothing and Accessories (5 boxes)',
            quantity: 5,
            unitPrice: 50.00,
            total: 250.00,
          },
        ],
        totals: {
          subtotal: 1800.00,
          tax: 0.00,
          total: 1800.00,
          paid: 500.00,
          balance: 1300.00,
        },
        currency: 'USD',
        notes: 'Please ensure all items are properly packaged. Contact us for any clarifications.',
      };

      const result = await service.generateInvoicePDF(invoiceData);

      expect(result).toBeDefined();
      expect(result.key).toContain('INV-2026-00123');
      expect(s3Service.uploadFileWithBucket).toHaveBeenCalled();
    });

    it('should generate AIR EXPRESS invoice PDF with dummy data', async function (): Promise<void> {
      const invoiceData: InvoiceData = {
        company: {
          name: 'AOSTP Express Shipping',
          address: '456 Airport Road, Accra, Ghana',
          phone: '+233-30-555-1234',
          email: 'express@aostp.com',
        },
        invoice: {
          number: 'INV-2026-00789',
          date: '2026-02-26',
          dueDate: '2026-03-01',
          status: 'PAID',
          shippingRate: 125.00,
        },
        customer: {
          code: 'CUST-VIP-002',
          name: 'Ama Osei-Bonsu',
          phone: '+233-54-222-3333',
          email: 'ama.osei@company.com',
        },
        package: {
          trackingCode: 'AIR-EXPRESS-2026-999',
          description: 'Urgent business documents and electronics',
          shippingMode: 'AIR',
          airType: 'EXPRESS_AIR',
          quantity: 1,
          weightKg: 15.0,
          shippingRate: 125.00,
          destinationCity: {
            id: 'city-2',
            name: 'Takoradi',
            country: 'Ghana',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          warehouse: 'Airport Warehouse',
          pickupCode: 'EXPRESS-PICK-456',
        },
        totals: {
          subtotal: 125.00,
          total: 125.00,
          paid: 125.00,
          balance: 0.00,
        },
        currency: 'USD',
      };

      const result = await service.generateInvoicePDF(invoiceData);

      expect(result).toBeDefined();
      expect(result.key).toContain('INV-2026-00789');
    });
  });

  describe('generateReceiptPDF', () => {
    it('should generate receipt PDF without error', async (): Promise<void> => {
      const receiptData: ReceiptData = {
        company: {
          name: 'Test Company',
          address: '123 Test St',
          phone: '123-456-7890',
          email: 'test@example.com',
        },
        receipt: {
          number: 'RCT-001',
          date: '2023-10-01',
          paymentMethod: 'Cash',
        },
        customer: {
          code: 'CUST-001',
          name: 'John Doe',
          phone: '098-765-4321',
          email: 'john@example.com',
        },
        payment: {
          amount: 110,
          currency: 'USD',
        },
        invoices: [
          {
            number: 'INV-001',
            total: 110,
            paid: 110,
            balance: 0,
          },
        ],
        package: {
          trackingCode: 'TRACK-001',
          description: 'Test Package',
          shippingMode: 'AIR',
          quantity: 1,
        },
      };

      const result = await service.generateReceiptPDF(receiptData);

      expect(result).toEqual({
        url: 'mock-url',
        key: 'receipts/receipt-RCT-001.pdf',
      });
      expect(s3Service.uploadFileWithBucket).toHaveBeenCalledWith(
        'test-bucket',
        'receipts/receipt-RCT-001.pdf',
        expect.any(Buffer),
        'application/pdf',
      );
    });
  });
});
