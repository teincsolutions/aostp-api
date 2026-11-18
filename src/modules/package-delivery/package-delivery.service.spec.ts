import { BadRequestException } from '@nestjs/common';
import { PackageStatus } from '@prisma/client';
import { PackageDeliveryService } from './package-delivery.service';

describe('PackageDeliveryService - createDelivery', () => {
  const invoice = {
    id: 'invoice-1',
    invoiceNumber: 'INV-1',
    customerId: 'customer-1',
    customer: { customerCode: 'CUS-1' },
    package: {
      id: 'package-1',
      trackingCode: 'TRK-1',
      status: PackageStatus.ARRIVED,
      warehouseId: 'warehouse-1',
      quantity: 1,
    },
    packingList: null,
  };

  let prisma: {
    invoice: { findMany: jest.Mock };
    packageDelivery: { findMany: jest.Mock };
  };
  let service: PackageDeliveryService;

  beforeEach(() => {
    prisma = {
      invoice: { findMany: jest.fn().mockResolvedValue([invoice]) },
      packageDelivery: { findMany: jest.fn().mockResolvedValue([]) },
    };

    service = new PackageDeliveryService(
      prisma as never,
      {} as never,
      {} as never,
    );
  });

  it('rejects a package that is already released', async () => {
    prisma.invoice.findMany.mockResolvedValueOnce([
      {
        ...invoice,
        package: { ...invoice.package, status: PackageStatus.RELEASED },
      },
    ]);

    await expect(
      service.createDelivery(
        {
          invoiceIds: ['invoice-1'],
          trackingCodes: ['TRK-1'],
          quantity: 1,
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.packageDelivery.findMany).not.toHaveBeenCalled();
  });

  it('rejects a package that already has a delivery record', async () => {
    prisma.packageDelivery.findMany.mockResolvedValueOnce([
      { packageId: 'package-1' },
    ]);

    await expect(
      service.createDelivery(
        {
          invoiceIds: ['invoice-1'],
          trackingCodes: ['TRK-1'],
          quantity: 1,
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
