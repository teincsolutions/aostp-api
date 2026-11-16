import { InvoiceStatus, PackageStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service';

describe('InvoicesService - getPendingDeliveryInvoices', () => {
  const prisma = {
    invoice: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };

  const service = new InvoicesService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.count.mockResolvedValue(0);
  });

  it('only returns PAID invoices whose packages are not delivered or released', async () => {
    const result = await service.getPendingDeliveryInvoices({
      customerId: 'customer-1',
    });

    const args = prisma.invoice.findMany.mock.calls[0][0];

    expect(args.where).toMatchObject({
      status: InvoiceStatus.PAID,
      customerId: 'customer-1',
      package: {
        delivery: null,
        status: { not: PackageStatus.RELEASED },
      },
    });
    expect(args.take).toBe(100);
    expect(result).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 100, totalPages: 0 },
    });
  });

  it('applies search across invoice number, tracking code and pickup code', async () => {
    await service.getPendingDeliveryInvoices({ search: 'INV-2026' });

    const args = prisma.invoice.findMany.mock.calls[0][0];

    expect(args.where.OR).toEqual([
      { invoiceNumber: { contains: 'INV-2026', mode: 'insensitive' } },
      { package: { trackingCode: { contains: 'INV-2026', mode: 'insensitive' } } },
      { package: { pickupCode: { contains: 'INV-2026', mode: 'insensitive' } } },
    ]);
  });

  it('allows up to 500 invoices per page for the pickup selector', async () => {
    await service.getPendingDeliveryInvoices({ limit: 500 });

    const args = prisma.invoice.findMany.mock.calls[0][0];

    expect(args.take).toBe(500);
  });
});
