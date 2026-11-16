import { PaymentGatewayStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService - update', () => {
  const existingPayment = {
    id: 'payment-1',
    paymentCode: 'RCPT-TEST-1',
    paymentMethod: 'CASH',
    receiptKey: 'receipts/receipt-RCPT-TEST-1.pdf',
    gatewayStatus: null as PaymentGatewayStatus | null,
    customerId: 'customer-1',
    invoices: [{ id: 'invoice-1' }],
  };

  const receiptPayment = {
    ...existingPayment,
    paymentMethod: 'DIRECT_MOMO_TRANSFER',
    processedAt: new Date('2026-11-16T10:00:00.000Z'),
    amount: 100,
    localAmount: 1200,
    currency: 'USD',
    reference: 'MOMO-123',
    notes: null,
    customer: {
      customerCode: 'CUS-1',
      firstName: 'Test',
      lastName: 'Customer',
      phoneNumber: '0200000000',
      email: 'test@example.com',
    },
    processedBy: { firstName: 'Admin' },
    invoices: [
      {
        id: 'invoice-1',
        invoiceNumber: 'INV-1',
        totalAmount: 100,
        paidAmount: 100,
        balance: 0,
        package: null,
        packingList: null,
      },
    ],
  };

  let prisma: {
    payment: { findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    payment: { update: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let pdfService: { generateReceiptPDF: jest.Mock };
  let invoicesService: { refreshInvoicePdfs: jest.Mock };
  let service: PaymentsService;

  beforeEach(() => {
    tx = {
      payment: {
        update: jest.fn().mockResolvedValue({
          ...existingPayment,
          paymentMethod: 'DIRECT_MOMO_TRANSFER',
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    prisma = {
      payment: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (callback: (client: typeof tx) => unknown) =>
          callback(tx),
        ),
    };

    pdfService = {
      generateReceiptPDF: jest
        .fn()
        .mockResolvedValue({
          url: 'https://example.com/receipt.pdf',
          key: 'receipts/receipt-RCPT-TEST-1.pdf',
        }),
    };

    invoicesService = {
      refreshInvoicePdfs: jest.fn().mockResolvedValue(undefined),
    };

    service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      pdfService as never,
      {} as never,
      invoicesService as never,
    );
  });

  it('regenerates the receipt and linked invoice PDFs after an update', async () => {
    prisma.payment.findUnique
      .mockResolvedValueOnce(existingPayment)
      .mockResolvedValueOnce(receiptPayment);

    await service.update(
      'payment-1',
      { paymentMethod: 'DIRECT_MOMO_TRANSFER', reference: 'MOMO-123' },
      'user-1',
    );

    expect(pdfService.generateReceiptPDF).toHaveBeenCalledTimes(1);
    expect(
      pdfService.generateReceiptPDF.mock.calls[0][0].receipt,
    ).toMatchObject({
      number: 'RCPT-TEST-1',
      paymentMethod: 'DIRECT_MOMO_TRANSFER',
    });
    expect(invoicesService.refreshInvoicePdfs).toHaveBeenCalledWith([
      'invoice-1',
    ]);
  });

  it('still succeeds when receipt regeneration fails', async () => {
    prisma.payment.findUnique
      .mockResolvedValueOnce(existingPayment)
      .mockResolvedValueOnce(receiptPayment);
    pdfService.generateReceiptPDF.mockRejectedValueOnce(
      new Error('storage unavailable'),
    );

    await expect(
      service.update('payment-1', { paymentMethod: 'CASH' }, 'user-1'),
    ).resolves.toBeDefined();

    expect(invoicesService.refreshInvoicePdfs).toHaveBeenCalledWith([
      'invoice-1',
    ]);
  });

  it('does not generate a receipt for a pending gateway payment', async () => {
    const pendingPayment = {
      ...existingPayment,
      receiptKey: null,
      gatewayStatus: PaymentGatewayStatus.PENDING,
    };

    prisma.payment.findUnique.mockResolvedValueOnce(pendingPayment);
    tx.payment.update.mockResolvedValueOnce(pendingPayment);

    await service.update('payment-1', { notes: 'updated' }, 'user-1');

    expect(pdfService.generateReceiptPDF).not.toHaveBeenCalled();
    expect(invoicesService.refreshInvoicePdfs).toHaveBeenCalledWith([
      'invoice-1',
    ]);
  });
});
