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
    it('should generate invoice PDF without error', async function () {
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

      const result = await service.generateInvoicePDF(invoiceData);

      expect(result).toEqual({
        url: 'mock-url',
        key: 'invoices/invoice-INV-001.pdf',
      });
      expect(s3Service.uploadFileWithBucket).toHaveBeenCalledWith(
        'test-bucket',
        'invoices/invoice-INV-001.pdf',
        expect.any(Buffer),
        'application/pdf',
      );
    });
  });

  describe('generateReceiptPDF', () => {
    it('should generate receipt PDF without error', async function () {
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
