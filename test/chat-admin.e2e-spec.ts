import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { io as ioClient, Socket } from 'socket.io-client';
import { of } from 'rxjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import * as bcrypt from 'bcrypt';
import { MessageDirection, PackageStatus, ShippingMode, UserRole } from '@prisma/client';
import { ChatService } from '../src/modules/chat/chat.service';
import { WhatsAppWebhookService } from '../src/modules/whatsapp-webhook/whatsapp-webhook.service';

describe('Chat Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let httpServer: any;
  let mockHttpService: { post: jest.Mock };
  let adminToken: string;
  let customerToken: string;
  let adminUser: { id: string; firstName: string; lastName: string };

  const ADMIN_EMAIL = 'admin.chat@aostp.test';
  const ADMIN_PASSWORD = 'TestPass123!';
  const CUSTOMER_EMAIL = 'customer.chat@aostp.test';
  const CUSTOMER_PASSWORD = 'TestPass123!';
  const TEST_PHONE = '233537776709';
  const TRACKING_CODE = 'AOSTP-E2E-001';
  const INVOICE_NUMBER = 'INV-E2E-001';

  beforeAll(async () => {
    mockHttpService = {
      post: jest.fn().mockReturnValue(of({ data: { messages: [{ id: 'wa_e2e_msg' }] } })),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue(mockHttpService)
      .compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        validationError: { target: false, value: false },
      }),
    );

    await app.init();
    await app.listen(0);

    httpServer = app.getHttpServer();
    prisma = app.get(PrismaService);

    // Inject dummy WhatsApp credentials so services attempt API calls (caught by mock)
    const chatService = app.get(ChatService);
    const webhookService = app.get(WhatsAppWebhookService);
    (chatService as any).accessToken = 'e2e-test-token';
    (chatService as any).phoneNumberId = 'e2e-test-phone-id';
    (webhookService as any).accessToken = 'e2e-test-token';
    (webhookService as any).phoneNumberId = 'e2e-test-phone-id';

    await seedDatabase();
  });

  async function seedDatabase() {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "ChatMessage", "RefreshToken", "Package", "Invoice", "Customer", "User", "Warehouse"
      CASCADE
    `);

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const customerHashed = await bcrypt.hash(CUSTOMER_PASSWORD, 10);

    adminUser = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        username: 'admin_chat_e2e',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'Chat',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: CUSTOMER_EMAIL,
        username: 'customer_chat_e2e',
        password: customerHashed,
        firstName: 'Customer',
        lastName: 'Chat',
        role: UserRole.CUSTOMER,
        isActive: true,
      },
    });

    const warehouse = await prisma.warehouse.create({
      data: {
        warehouseId: 'WH-E2E',
        name: 'E2E Test Warehouse',
        location: 'Test Location',
      },
    });

    const customer = await prisma.customer.create({
      data: {
        customerCode: 'CUST-E2E-001',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: TEST_PHONE,
        warehouseId: warehouse.id,
      },
    });

    const pkg = await prisma.package.create({
      data: {
        trackingCode: TRACKING_CODE,
        customerId: customer.id,
        warehouseId: warehouse.id,
        description: 'E2E Test Package',
        shippingMode: ShippingMode.SEA,
        status: PackageStatus.RECEIVED,
        createdById: adminUser.id,
      },
    });

    await prisma.invoice.create({
      data: {
        invoiceNumber: INVOICE_NUMBER,
        customerId: customer.id,
        packageId: pkg.id,
        totalAmount: 1500.0,
        currency: 'USD',
        exchangeRate: 15.5,
        localAmount: 23250.0,
        status: 'UNPAID',
        dueDate: new Date('2026-07-01'),
        paidAmount: 0,
        balance: 1500.0,
      },
    });

    await prisma.chatMessage.createMany({
      data: [
        {
          conversationId: TEST_PHONE,
          fromNumber: TEST_PHONE,
          toNumber: 'business',
          direction: MessageDirection.INBOUND,
          text: 'Hello, I want to track my package',
          createdAt: new Date('2026-05-20T10:00:00Z'),
        },
        {
          conversationId: TEST_PHONE,
          fromNumber: 'business',
          toNumber: TEST_PHONE,
          direction: MessageDirection.OUTBOUND,
          text: 'Sure, please share your tracking code',
          createdAt: new Date('2026-05-20T10:00:30Z'),
        },
        {
          conversationId: TEST_PHONE,
          fromNumber: TEST_PHONE,
          toNumber: 'business',
          direction: MessageDirection.INBOUND,
          text: TRACKING_CODE,
          createdAt: new Date('2026-05-20T10:01:00Z'),
        },
      ],
    });
  }

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "ChatMessage", "RefreshToken", "Package", "Invoice", "Customer", "User", "Warehouse"
      CASCADE
    `);
    await app.close();
  });

  // ─── Helpers ────────────────────────────────────────────

  async function loginAs(email: string, password: string): Promise<string> {
    const res = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken;
  }

  function validMetaWebhookPayload(overrides?: {
    from?: string;
    messageType?: string;
    textBody?: string;
    interactive?: any;
  }): any {
    const from = overrides?.from || TEST_PHONE;
    const msgId = 'e2e_msg_' + Date.now();
    const message: any = {
      from,
      id: msgId,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      type: overrides?.messageType || 'text',
    };

    if (overrides?.messageType === 'interactive' && overrides?.interactive) {
      message.interactive = overrides.interactive;
    } else {
      message.text = { body: overrides?.textBody || 'Hello' };
    }

    return {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'e2e_wa_id',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15551234567',
                  phone_number_id: 'e2e_phone_id',
                },
                contacts: [{ profile: { name: 'John Doe' }, wa_id: from }],
                messages: [message],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };
  }

  // ─── Tests ──────────────────────────────────────────────

  describe('Authentication', () => {
    it('should return 401 for unauthenticated chat access', async () => {
      await request(httpServer).get('/api/v1/chat/conversations').expect(401);
    });

    it('should return 403 for CUSTOMER role', async () => {
      customerToken = await loginAs(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await request(httpServer)
        .get('/api/v1/chat/conversations')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('should allow SUPER_ADMIN to access chat endpoints', async () => {
      adminToken = await loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
      await request(httpServer)
        .get('/api/v1/chat/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Conversations', () => {
    it('should list conversations with unread counts', async () => {
      const res = await request(httpServer)
        .get('/api/v1/chat/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.conversations).toBeInstanceOf(Array);
      expect(res.body.conversations.length).toBeGreaterThanOrEqual(1);

      const conv = res.body.conversations.find(
        (c: any) => c.conversationId === TEST_PHONE,
      );
      expect(conv).toBeDefined();
      expect(conv.phoneNumber).toBe(TEST_PHONE);
      expect(conv.customerName).toBe('John Doe');
      expect(conv.customerCode).toBe('CUST-E2E-001');
      expect(conv.unreadCount).toBeGreaterThanOrEqual(2);
      expect(conv.lastMessage).toBeDefined();
      expect(conv.lastDirection).toBeDefined();
    });
  });

  describe('Messages', () => {
    it('should get conversation messages paginated', async () => {
      const res = await request(httpServer)
        .get(`/api/v1/chat/conversations/${TEST_PHONE}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.messages).toBeInstanceOf(Array);
      expect(res.body.messages.length).toBeGreaterThanOrEqual(3);
      expect(res.body.total).toBeGreaterThanOrEqual(3);

      const msg = res.body.messages[0];
      expect(msg).toHaveProperty('id');
      expect(msg).toHaveProperty('direction');
      expect(msg).toHaveProperty('messageType');
      expect(msg).toHaveProperty('text');
      expect(msg).toHaveProperty('createdAt');
    });

    it('should mark inbound messages as read when fetched', async () => {
      await request(httpServer)
        .get(`/api/v1/chat/conversations/${TEST_PHONE}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const res = await request(httpServer)
        .get('/api/v1/chat/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const conv = res.body.conversations.find(
        (c: any) => c.conversationId === TEST_PHONE,
      );
      expect(conv).toBeDefined();
      expect(conv.unreadCount).toBe(0);
    });
  });

  describe('Send Reply', () => {
    beforeEach(() => {
      mockHttpService.post.mockClear();
    });

    it('should send text reply and persist with repliedBy', async () => {
      const res = await request(httpServer)
        .post('/api/v1/chat/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ to: TEST_PHONE, text: 'Your package is on its way!' })
        .expect(200);

      const saved = res.body;

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com'),
        expect.objectContaining({
          type: 'text',
          text: { body: 'Your package is on its way!' },
        }),
        expect.any(Object),
      );

      expect(saved.messageType).toBe('text');
      expect(saved.text).toBe('Your package is on its way!');
      expect(saved.direction).toBe('OUTBOUND');
      expect(saved.toNumber).toBe(TEST_PHONE);
      expect(saved.repliedBy).toBeDefined();
      expect(saved.repliedBy.id).toBe(adminUser.id);
      expect(saved.repliedBy.firstName).toBe('Admin');
      expect(saved.repliedBy.lastName).toBe('Chat');
    });

    it('should send image reply with correct WhatsApp payload', async () => {
      await request(httpServer)
        .post('/api/v1/chat/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          to: TEST_PHONE,
          type: 'image',
          mediaUrl: 'https://s3.example.com/photo.jpg',
          text: 'Here is your delivery photo',
        })
        .expect(200);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com'),
        expect.objectContaining({
          type: 'image',
          image: {
            link: 'https://s3.example.com/photo.jpg',
            caption: 'Here is your delivery photo',
          },
        }),
        expect.any(Object),
      );

      // Verify DB record
      const res = await request(httpServer)
        .get(`/api/v1/chat/conversations/${TEST_PHONE}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const imageMsg = res.body.messages.find(
        (m: any) => m.messageType === 'image',
      );
      expect(imageMsg).toBeDefined();
      expect(imageMsg.messageType).toBe('image');
      expect(imageMsg.text).toBe('Here is your delivery photo');
    });

    it('should send document reply with correct WhatsApp payload', async () => {
      await request(httpServer)
        .post('/api/v1/chat/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          to: TEST_PHONE,
          type: 'document',
          mediaUrl: 'https://s3.example.com/invoice.pdf',
          filename: 'invoice-E2E-001.pdf',
          text: 'Your invoice is ready',
        })
        .expect(200);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com'),
        expect.objectContaining({
          type: 'document',
          document: {
            link: 'https://s3.example.com/invoice.pdf',
            filename: 'invoice-E2E-001.pdf',
            caption: 'Your invoice is ready',
          },
        }),
        expect.any(Object),
      );
    });
  });

  describe('Webhook → Chatbot → Conversation', () => {
    beforeEach(() => {
      mockHttpService.post.mockClear();
    });

    it('should process inbound tracking code and create conversation messages', async () => {
      await request(httpServer)
        .post('/api/v1/webhook/whatsapp')
        .send(validMetaWebhookPayload({ textBody: TRACKING_CODE }))
        .expect(200);

      // WhatsApp API called for: markAsRead + sendReply
      const textCalls = mockHttpService.post.mock.calls.filter(
        (call: any) =>
          call[0].includes('graph.facebook.com') &&
          call[1]?.type === 'text',
      );
      expect(textCalls.length).toBeGreaterThanOrEqual(1);

      // At least one reply contains the tracking code
      const replyCall = textCalls.find(
        (call: any) =>
          call[1]?.text?.body?.includes(TRACKING_CODE) ||
          call[1]?.text?.body?.includes('AOSTP'),
      );
      expect(replyCall).toBeDefined();

      // Verify messages persisted
      const res = await request(httpServer)
        .get(`/api/v1/chat/conversations/${TEST_PHONE}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const inboundMsgs = res.body.messages.filter(
        (m: any) => m.direction === 'INBOUND' && m.text === TRACKING_CODE,
      );
      expect(inboundMsgs.length).toBeGreaterThanOrEqual(1);

      const outboundReply = res.body.messages.find(
        (m: any) =>
          m.direction === 'OUTBOUND' && m.text?.includes(TRACKING_CODE),
      );
      expect(outboundReply).toBeDefined();
    });

    it('should process invoice lookup via chatbot', async () => {
      mockHttpService.post.mockClear();

      await request(httpServer)
        .post('/api/v1/webhook/whatsapp')
        .send(validMetaWebhookPayload({ textBody: INVOICE_NUMBER }))
        .expect(200);

      const replyCalls = mockHttpService.post.mock.calls.filter(
        (call: any) =>
          call[0]?.includes('graph.facebook.com') &&
          call[1]?.type === 'text' &&
          call[1]?.text?.body?.includes(INVOICE_NUMBER),
      );
      expect(replyCalls.length).toBeGreaterThanOrEqual(1);
      const replyBody = replyCalls[0][1].text.body;
      expect(replyBody).toContain('INV-E2E');
    });
  });

  describe('Interactive List Reply', () => {
    beforeEach(() => {
      mockHttpService.post.mockClear();
    });

    it('should process interactive list reply and send prompt', async () => {
      await request(httpServer)
        .post('/api/v1/webhook/whatsapp')
        .send(
          validMetaWebhookPayload({
            messageType: 'interactive',
            interactive: {
              type: 'list_reply',
              list_reply: { id: 'TRACK', title: 'Track Package', description: '' },
            },
          }),
        )
        .expect(200);

      // WhatsApp API called for: markAsRead + sendReply (prompt)
      const textCalls = mockHttpService.post.mock.calls.filter(
        (call: any) =>
          call[0]?.includes('graph.facebook.com') &&
          call[1]?.type === 'text',
      );
      expect(textCalls.length).toBeGreaterThanOrEqual(1);

      // One call should be the prompt
      const promptCall = textCalls.find(
        (call: any) =>
          call[1]?.text?.body?.includes('tracking code') ||
          call[1]?.text?.body?.includes('intake code'),
      );
      expect(promptCall).toBeDefined();

      // Verify interactive message persisted
      const res = await request(httpServer)
        .get(`/api/v1/chat/conversations/${TEST_PHONE}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const interactiveMsg = res.body.messages.find(
        (m: any) => m.messageType === 'interactive',
      );
      expect(interactiveMsg).toBeDefined();
      expect(interactiveMsg.text).toContain('List reply: TRACK');
    });
  });

  describe('WebSocket Live Updates', () => {
    let socket: Socket;

    afterEach(() => {
      if (socket?.connected) {
        socket.disconnect();
      }
    });

    async function waitForWsEvent(
      s: Socket,
      predicate: (data: any) => boolean,
      timeoutMs = 8000,
    ): Promise<any> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          s.off('new-message');
          reject(new Error('WebSocket event timeout'));
        }, timeoutMs);
        s.on('new-message', (data: any) => {
          if (predicate(data)) {
            clearTimeout(timer);
            resolve(data);
          }
        });
      });
    }

    it('should emit new-message event when admin sends reply', async () => {
      mockHttpService.post.mockClear();

      const port = (httpServer.address() as any).port;
      socket = ioClient(`http://localhost:${port}/chat`, {
        transports: ['websocket'],
        forceNew: true,
      });

      // Wait for connection then send reply
      await new Promise<void>((resolve) => socket.on('connect', resolve));

      const wsPromise = waitForWsEvent(
        socket,
        (d) => d.text === 'WebSocket test reply',
      );

      await request(httpServer)
        .post('/api/v1/chat/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ to: TEST_PHONE, text: 'WebSocket test reply' })
        .expect(200);

      const eventData = await wsPromise;
      expect(eventData).toBeDefined();
      expect(eventData.text).toBe('WebSocket test reply');
      expect(eventData.direction).toBe('OUTBOUND');
      expect(eventData.conversationId).toBe(TEST_PHONE);
      expect(eventData.toNumber).toBe(TEST_PHONE);
      expect(eventData.messageType).toBe('text');
      expect(eventData.repliedBy).toBeDefined();
      expect(eventData.repliedBy.id).toBe(adminUser.id);
    });

    it('should emit new-message event when inbound webhook message arrives', async () => {
      mockHttpService.post.mockClear();

      const port = (httpServer.address() as any).port;
      socket = ioClient(`http://localhost:${port}/chat`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await new Promise<void>((resolve) => socket.on('connect', resolve));

      const wsPromise = waitForWsEvent(
        socket,
        (d) => d.direction === 'INBOUND' && d.text === 'Where is it?',
      );

      await request(httpServer)
        .post('/api/v1/webhook/whatsapp')
        .send(validMetaWebhookPayload({ textBody: 'Where is it?' }))
        .expect(200);

      const eventData = await wsPromise;
      expect(eventData).toBeDefined();
      expect(eventData.text).toBe('Where is it?');
      expect(eventData.direction).toBe('INBOUND');
      expect(eventData.conversationId).toBe(TEST_PHONE);
      expect(eventData.fromNumber).toBe(TEST_PHONE);
    });
  });
});
