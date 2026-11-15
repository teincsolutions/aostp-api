import { NotificationChannel } from '@prisma/client';
import {
  CustomerExportRow,
  CustomersExportService,
} from './customers-export.service';

describe('CustomersExportService', () => {
  const service = new CustomersExportService();

  const rows: CustomerExportRow[] = [
    {
      id: '3f1b2c4d-0000-4000-8000-000000000001',
      customerCode: 'JOHN-23456',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+233501234567',
      alternatePhone: null,
      address: '12 Independence Avenue',
      warehouseId: null,
      cityId: null,
      idType: 'NATIONAL_ID',
      idNumber: 'GHA-123456789',
      preferredChannel: NotificationChannel.EMAIL,
      isActive: true,
      createdAt: new Date('2026-01-15T10:30:00.000Z'),
      updatedAt: new Date('2026-01-15T10:30:00.000Z'),
      warehouse: null,
      cityRef: { id: 'city-1', name: 'Accra', country: 'Ghana' },
      _count: { packages: 4, invoices: 2, payments: 3 },
    },
  ];

  it('generates a PDF document', async () => {
    const file = await service.generate(rows, 'pdf');

    expect(file.contentType).toBe('application/pdf');
    expect(file.filename).toMatch(/^customers-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(file.buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('generates an Excel workbook', async () => {
    const file = await service.generate(rows, 'excel');

    expect(file.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(file.filename).toMatch(/^customers-\d{4}-\d{2}-\d{2}\.xlsx$/);
    // XLSX files are ZIP archives.
    expect(file.buffer.subarray(0, 2).toString()).toBe('PK');
  });

  it('still produces a document when there are no rows', async () => {
    const pdf = await service.generate([], 'pdf');
    const excel = await service.generate([], 'excel');

    expect(pdf.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(excel.buffer.subarray(0, 2).toString()).toBe('PK');
  });
});
