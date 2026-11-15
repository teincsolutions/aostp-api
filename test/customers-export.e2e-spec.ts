import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CustomersController } from '../src/modules/customers/customers.controller';
import { CustomersService } from '../src/modules/customers/customers.service';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';
import { RolesGuard } from '../src/shared/guards/roles.guard';

describe('Customers export (e2e)', () => {
  let app: INestApplication<App>;

  const exportedFile = {
    buffer: Buffer.from('%PDF-1.4 test'),
    filename: 'customers-2026-11-15.pdf',
    contentType: 'application/pdf',
  };

  const customersService = {
    exportCustomers: jest.fn().mockResolvedValue(exportedFile),
    getExportFileInfo: jest.fn((format: 'pdf' | 'excel', all: boolean) => {
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      return {
        contentType:
          format === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf',
        filename: `${all ? 'customers-all' : 'customers'}-2026-11-15.${extension}`,
      };
    }),
    streamExportCustomers: jest
      .fn()
      .mockImplementation(
        async (_dto: unknown, res: { end: (chunk: Buffer) => void }) => {
          res.end(Buffer.from('%PDF-1.4 all'));
        },
      ),
    findOne: jest.fn().mockResolvedValue({ id: 'customer-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        {
          provide: CustomersService,
          useValue: customersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('downloads the export file and is not shadowed by the :id route', async () => {
    const response = await request(app.getHttpServer())
      .get('/customers/export')
      .query({ format: 'pdf', ids: 'customer-1,customer-2' })
      .expect(200);

    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="customers-2026-11-15.pdf"',
    );
    expect(response.headers['cache-control']).toBe('no-store');
    expect(customersService.findOne).not.toHaveBeenCalled();
    expect(customersService.exportCustomers).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'pdf',
        ids: ['customer-1', 'customer-2'],
      }),
    );
    expect(Buffer.from(response.body).toString()).toBe('%PDF-1.4 test');
  });

  it('accepts repeated ids query params', async () => {
    await request(app.getHttpServer())
      .get('/customers/export')
      .query('format=excel&ids=customer-1&ids=customer-2')
      .expect(200);

    expect(customersService.exportCustomers).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'excel',
        ids: ['customer-1', 'customer-2'],
      }),
    );
  });

  it('rejects an unsupported format', async () => {
    await request(app.getHttpServer())
      .get('/customers/export')
      .query({ format: 'csv' })
      .expect(400);

    expect(customersService.exportCustomers).not.toHaveBeenCalled();
  });

  it('streams all customers when all=true', async () => {
    const response = await request(app.getHttpServer())
      .get('/customers/export')
      .query({ format: 'pdf', all: 'true' })
      .expect(200);

    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="customers-all-2026-11-15.pdf"',
    );
    expect(customersService.streamExportCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'pdf', all: true }),
      expect.anything(),
    );
    expect(customersService.exportCustomers).not.toHaveBeenCalled();
    expect(Buffer.from(response.body).toString()).toBe('%PDF-1.4 all');
  });

  it('still resolves GET /customers/:id normally', async () => {
    await request(app.getHttpServer()).get('/customers/customer-1').expect(200);

    expect(customersService.findOne).toHaveBeenCalledWith('customer-1');
    expect(customersService.exportCustomers).not.toHaveBeenCalled();
  });
});
