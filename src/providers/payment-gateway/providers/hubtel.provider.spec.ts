import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HubtelProvider } from './hubtel.provider';
import {
  ProcessPaymentData,
  PaymentStatus,
} from '../payment-gateway.interface';

describe('HubtelProvider', () => {
  let provider: HubtelProvider;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HubtelProvider,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    provider = module.get<HubtelProvider>(HubtelProvider);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with config values', () => {
      mockConfigService.get
        .mockReturnValueOnce('https://invoicing.hubtel.com')
        .mockReturnValueOnce('POS123')
        .mockReturnValueOnce('username')
        .mockReturnValueOnce('password')
        .mockReturnValueOnce('api_key_123');

      const newProvider = new HubtelProvider(configService);

      expect(newProvider).toBeDefined();
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'HUBTEL_BASE_URL',
        'https://invoicing.hubtel.com',
      );
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'HUBTEL_POS_SALES_ID',
        '',
      );
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'HUBTEL_USERNAME',
        '',
      );
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'HUBTEL_PASSWORD',
        '',
      );
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'HUBTEL_API_KEY',
        '',
      );
    });

    it('should use default values when config is not set', () => {
      mockConfigService.get.mockReturnValue('');

      const newProvider = new HubtelProvider(configService);
      expect(newProvider).toBeDefined();
    });
  });

  describe('processPayment', () => {
    const mockFetch = jest.fn();

    beforeEach(() => {
      global.fetch = mockFetch;

      // Setup config mocks
      mockConfigService.get
        .mockReturnValueOnce('https://invoicing.hubtel.com')
        .mockReturnValueOnce('POS123')
        .mockReturnValueOnce('username')
        .mockReturnValueOnce('password')
        .mockReturnValueOnce('api_key_123');

      // Reinitialize provider with fresh config
      const newProvider = new HubtelProvider(configService);
      Object.setPrototypeOf(provider, Object.getPrototypeOf(newProvider));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    const validPaymentData: ProcessPaymentData = {
      amount: 100.50,
      currency: 'GHS',
      customerEmail: 'test@example.com',
      customerPhone: '+233501234567',
      customerName: 'John Doe',
      reference: 'PAY001',
      description: 'Test payment for invoice',
      metadata: {
        userId: 'user123',
        customerCode: 'CUST001',
        paymentMethod: 'MOBILE_MONEY',
      },
    };

    it('should successfully process a payment', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          message: 'Invoice created successfully',
          code: 200,
          data: {
            invoiceId: 'INV-12345',
            paymentUrl: 'https://hubtel.com/pay/INV-12345',
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await provider.processPayment(validPaymentData);

      expect(result.success).toBe(true);
      expect(result.gatewayTransactionId).toBe('INV-12345');
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.paymentUrl).toBe('https://hubtel.com/pay/INV-12345');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://invoicing.hubtel.com/api/invoice/POS123/pay-at-once',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringContaining('Basic '),
          }),
          body: expect.any(String),
        }),
      );
    });

    it('should handle API errors gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Bad Request Error'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await provider.processPayment(validPaymentData);

      expect(result.success).toBe(false);
      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.errorMessage).toContain('Hubtel API error: 400');
      expect(result.gatewayResponse.httpStatus).toBe(400);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network timeout'));

      const result = await provider.processPayment(validPaymentData);

      expect(result.success).toBe(false);
      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.errorMessage).toContain('Payment processing failed: Network timeout');
    });

    it('should create proper invoice payload', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 200,
          data: { invoiceId: 'INV-123', paymentUrl: 'url' },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await provider.processPayment(validPaymentData);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody).toEqual({
        invoiceNumber: 'PAY001',
        customerName: 'John Doe',
        customerPhoneNumber: '+233501234567',
        customerEmail: 'test@example.com',
        hasTax: false,
        issuedBy: 'userId:user123',
        createdBy: 'userId:user123',
        dueDate: expect.any(String),
        items: [
          {
            description: 'Test payment for invoice',
            quantity: 1,
            unitPrice: 100.50,
          },
        ],
        callbackUrl: '',
        reminders: [
          {
            days: 5,
            isBefore: true,
          },
        ],
      });
    });

    it('should handle missing customer data gracefully', async () => {
      const paymentDataWithoutCustomer: ProcessPaymentData = {
        amount: 50.00,
        currency: 'GHS',
        reference: 'PAY002',
        description: 'Payment without customer info',
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 200,
          data: { invoiceId: 'INV-456', paymentUrl: 'url' },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await provider.processPayment(paymentDataWithoutCustomer);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.customerName).toBe('Customer');
      expect(requestBody.customerPhoneNumber).toBe('');
      expect(requestBody.customerEmail).toBeUndefined();
    });
  });

  describe('getPaymentStatus', () => {
    const mockFetch = jest.fn();

    beforeEach(() => {
      global.fetch = mockFetch;

      mockConfigService.get
        .mockReturnValueOnce('https://invoicing.hubtel.com')
        .mockReturnValueOnce('POS123')
        .mockReturnValueOnce('username')
        .mockReturnValueOnce('password')
        .mockReturnValueOnce('api_key_123');

      const newProvider = new HubtelProvider(configService);
      Object.setPrototypeOf(provider, Object.getPrototypeOf(newProvider));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return COMPLETED for Paid In Full status', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 200,
          data: {
            paymentStatus: 'Paid In Full',
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const status = await provider.getPaymentStatus('TXN-123');

      expect(status).toBe(PaymentStatus.COMPLETED);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://invoicing.hubtel.com/api/invoice/POS123/TXN-123/status-check',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic '),
          }),
        }),
      );
    });

    it('should return PENDING for Pending status', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 200,
          data: {
            paymentStatus: 'Pending',
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const status = await provider.getPaymentStatus('TXN-456');

      expect(status).toBe(PaymentStatus.PENDING);
    });

    it('should return PENDING when API fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };

      mockFetch.mockResolvedValue(mockResponse);

      const status = await provider.getPaymentStatus('TXN-789');

      expect(status).toBe(PaymentStatus.PENDING);
    });

    it('should return PENDING on network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const status = await provider.getPaymentStatus('TXN-999');

      expect(status).toBe(PaymentStatus.PENDING);
    });
  });

  describe('refundPayment', () => {
    it('should return refund not supported message', async () => {
      const result = await provider.refundPayment({
        gatewayTransactionId: 'TXN-123',
        amount: 50.00,
        reason: 'Customer request',
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Refunds must be processed through Hubtel dashboard');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return true for webhook signature verification', () => {
      const isValid = provider.verifyWebhookSignature?.('sig123', 'body123');
      expect(isValid).toBe(true);
    });
  });
});
