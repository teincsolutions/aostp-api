import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let gateway: any;
  let httpService: any;

  const mockPrisma = {
    chatMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      updateMany: jest.fn(),
    },
    customer: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockGateway = {
    notifyNewMessage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        WHATSAPP_ACCESS_TOKEN: 'test-token',
        WHATSAPP_PHONE_NUMBER_ID: 'test-phone-id',
      };
      return config[key] ?? defaultValue;
    });

    mockHttpService.post.mockReturnValue(
      of({
        data: {
          messages: [{ id: 'wa_msg_123' }],
        },
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ChatGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    prisma = module.get(PrismaService);
    gateway = module.get(ChatGateway);
    httpService = module.get(HttpService);
  });

  describe('saveMessage', () => {
    it('should persist an inbound message and notify gateway', async () => {
      const savedMsg = {
        id: 'msg-1',
        conversationId: '233537776709',
        fromNumber: '233537776709',
        toNumber: 'business',
        direction: 'INBOUND',
        messageType: 'text',
        text: 'Hello',
        status: 'sent',
        waMessageId: null,
        repliedById: null,
        readAt: null,
        createdAt: new Date('2026-05-17T12:00:00Z'),
        updatedAt: new Date('2026-05-17T12:00:00Z'),
      };
      mockPrisma.chatMessage.create.mockResolvedValue(savedMsg);

      const result = await service.saveMessage({
        conversationId: '233537776709',
        fromNumber: '233537776709',
        toNumber: 'business',
        direction: 'INBOUND',
        text: 'Hello',
      });

      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: '233537776709',
          fromNumber: '233537776709',
          direction: 'INBOUND',
          text: 'Hello',
        }),
      });
      expect(result).toEqual(savedMsg);
      expect(gateway.notifyNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          direction: 'INBOUND',
          text: 'Hello',
        }),
      );
    });

    it('should persist an outbound message with waMessageId', async () => {
      const savedMsg = {
        id: 'msg-2',
        conversationId: '233537776709',
        fromNumber: 'business',
        toNumber: '233537776709',
        direction: 'OUTBOUND',
        messageType: 'text',
        text: 'Reply text',
        status: 'sent',
        waMessageId: 'wa_abc_123',
        repliedById: null,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.chatMessage.create.mockResolvedValue(savedMsg);

      const result = await service.saveMessage({
        conversationId: '233537776709',
        fromNumber: 'business',
        toNumber: '233537776709',
        direction: 'OUTBOUND',
        text: 'Reply text',
        waMessageId: 'wa_abc_123',
      });

      expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          waMessageId: 'wa_abc_123',
          status: 'sent',
        }),
      });
      expect(result).toEqual(savedMsg);
      expect(gateway.notifyNewMessage).toHaveBeenCalled();
    });

    it('should include repliedById when provided', async () => {
      const savedMsg = {
        id: 'msg-3',
        repliedById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.chatMessage.create.mockResolvedValue(savedMsg);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        firstName: 'Admin',
        lastName: 'User',
      });

      await service.saveMessage({
        conversationId: 'conv-1',
        fromNumber: 'business',
        toNumber: '233500000000',
        direction: 'OUTBOUND',
        text: 'Admin reply',
        repliedById: 'user-1',
      });

      expect(gateway.notifyNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          repliedBy: { id: 'user-1', firstName: 'Admin', lastName: 'User' },
        }),
      );
    });
  });

  describe('getConversations', () => {
    it('should return grouped conversations with enriched data', async () => {
      mockPrisma.chatMessage.groupBy.mockResolvedValue([
        {
          conversationId: '233537776709',
          _count: { id: 5 },
          _max: { createdAt: new Date('2026-05-17T12:00:00Z') },
        },
        {
          conversationId: '233500000000',
          _count: { id: 3 },
          _max: { createdAt: new Date('2026-05-16T10:00:00Z') },
        },
      ]);

      mockPrisma.chatMessage.findFirst
        .mockResolvedValueOnce({
          text: 'Last message from 709',
          createdAt: new Date('2026-05-17T12:00:00Z'),
          direction: 'INBOUND',
        })
        .mockResolvedValueOnce({
          text: 'Last message from 000',
          createdAt: new Date('2026-05-16T10:00:00Z'),
          direction: 'OUTBOUND',
        });

      mockPrisma.chatMessage.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0);

      mockPrisma.customer.findFirst
        .mockResolvedValueOnce({
          firstName: 'John',
          lastName: 'Doe',
          customerCode: 'CUST-001',
        })
        .mockResolvedValueOnce(null);

      const result = await service.getConversations({ page: 1, limit: 20 });

      expect(result.conversations).toHaveLength(2);
      expect(result.total).toBe(2);

      const first = result.conversations[0];
      expect(first.conversationId).toBe('233537776709');
      expect(first.customerName).toBe('John Doe');
      expect(first.customerCode).toBe('CUST-001');
      expect(first.lastMessage).toBe('Last message from 709');
      expect(first.unreadCount).toBe(2);

      const second = result.conversations[1];
      expect(second.conversationId).toBe('233500000000');
      expect(second.customerName).toBeNull();
      expect(second.customerCode).toBeNull();
      expect(second.unreadCount).toBe(0);
    });

    it('should return empty list when no conversations exist', async () => {
      mockPrisma.chatMessage.groupBy.mockResolvedValue([]);

      const result = await service.getConversations({ page: 1, limit: 20 });

      expect(result.conversations).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getConversationMessages', () => {
    it('should return paginated messages and mark inbound as read', async () => {
      const messages = [
        {
          id: 'msg-1',
          direction: 'INBOUND',
          messageType: 'text',
          text: 'Hello',
          status: 'sent',
          waMessageId: null,
          readAt: null,
          createdAt: new Date('2026-05-17T12:00:00Z'),
          repliedBy: null,
        },
        {
          id: 'msg-2',
          direction: 'OUTBOUND',
          messageType: 'text',
          text: 'Hi there',
          status: 'sent',
          waMessageId: 'wa_123',
          readAt: null,
          createdAt: new Date('2026-05-17T12:01:00Z'),
          repliedBy: null,
        },
      ];

      mockPrisma.chatMessage.findMany.mockResolvedValue(messages);
      mockPrisma.chatMessage.count.mockResolvedValue(2);
      mockPrisma.chatMessage.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.getConversationMessages('233537776709', {
        page: 1,
        limit: 50,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);

      expect(mockPrisma.chatMessage.updateMany).toHaveBeenCalledWith({
        where: {
          conversationId: '233537776709',
          direction: 'INBOUND',
          readAt: null,
        },
        data: { readAt: expect.any(Date) },
      });
    });

    it('should paginate correctly', async () => {
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockPrisma.chatMessage.count.mockResolvedValue(60);
      mockPrisma.chatMessage.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.getConversationMessages('conv-1', {
        page: 2,
        limit: 20,
      });

      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
      expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        }),
      );
    });
  });

  describe('sendAdminReply', () => {
    it('should send via WhatsApp API and persist the message', async () => {
      mockPrisma.chatMessage.create.mockResolvedValue({
        id: 'admin-msg-1',
        conversationId: '233537776709',
        fromNumber: 'test-phone-id',
        toNumber: '233537776709',
        direction: 'OUTBOUND',
        messageType: 'text',
        text: 'Admin reply',
        status: 'sent',
        waMessageId: 'wa_msg_123',
        repliedById: 'user-1',
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.sendAdminReply(
        { to: '233537776709', text: 'Admin reply' },
        'user-1',
      );

      expect(httpService.post).toHaveBeenCalled();
      expect(mockPrisma.chatMessage.create).toHaveBeenCalled();
      expect(result.waMessageId).toBe('wa_msg_123');
    });

    it('should handle missing WhatsApp credentials gracefully', async () => {
      (service as any).accessToken = '';
      (service as any).phoneNumberId = '';

      mockPrisma.chatMessage.create.mockResolvedValue({
        id: 'admin-msg-2',
        conversationId: '233537776709',
        direction: 'OUTBOUND',
        text: 'Offline reply',
        status: 'failed',
        repliedById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.sendAdminReply(
        { to: '233537776709', text: 'Offline reply' },
        'user-1',
      );

      expect(httpService.post).not.toHaveBeenCalled();
      expect(result.status).toBe('failed');
    });
  });

  describe('markConversationRead', () => {
    it('should mark all inbound messages as read', async () => {
      mockPrisma.chatMessage.updateMany.mockResolvedValue({ count: 3 });

      await service.markConversationRead('233537776709');

      expect(mockPrisma.chatMessage.updateMany).toHaveBeenCalledWith({
        where: {
          conversationId: '233537776709',
          direction: 'INBOUND',
          readAt: null,
        },
        data: { readAt: expect.any(Date) },
      });
    });
  });
});
