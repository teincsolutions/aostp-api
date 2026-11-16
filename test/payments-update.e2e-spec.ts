import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PaymentsController } from '../src/modules/payments/payments.controller';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';
import { RolesGuard } from '../src/shared/guards/roles.guard';

describe('Payments update (e2e)', () => {
  let app: INestApplication<App>;

  const paymentsService = {
    update: jest.fn().mockImplementation((id: string, data: object) => ({
      id,
      ...data,
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: paymentsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();

    app.use((req: any, _res: any, next: any) => {
      req.user = { id: 'user-1' };
      next();
    });

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

  it('allows changing the payment method to Direct MoMo Transfer', async () => {
    await request(app.getHttpServer())
      .patch('/payments/payment-1')
      .send({
        paymentMethod: 'DIRECT_MOMO_TRANSFER',
        reference: 'MOMO-123456',
      })
      .expect(200);

    expect(paymentsService.update).toHaveBeenCalledWith(
      'payment-1',
      expect.objectContaining({
        paymentMethod: 'DIRECT_MOMO_TRANSFER',
        reference: 'MOMO-123456',
      }),
      'user-1',
    );
  });

  it('accepts a reference document key', async () => {
    await request(app.getHttpServer())
      .patch('/payments/payment-1')
      .send({
        paymentMethod: 'BANK_TRANSFER',
        referenceDocumentKey: 'payments/document.pdf',
      })
      .expect(200);

    expect(paymentsService.update).toHaveBeenCalledWith(
      'payment-1',
      expect.objectContaining({
        referenceDocumentKey: 'payments/document.pdf',
      }),
      'user-1',
    );
  });

  it('rejects an unknown payment method', async () => {
    await request(app.getHttpServer())
      .patch('/payments/payment-1')
      .send({ paymentMethod: 'BITCOIN' })
      .expect(400);

    expect(paymentsService.update).not.toHaveBeenCalled();
  });
});
