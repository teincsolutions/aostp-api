import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: any;

  const mockChatService = {
    getConversations: jest.fn(),
    getConversationMessages: jest.fn(),
    sendAdminReply: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: mockChatService }],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get(ChatService);
  });

  describe('GET /chat/conversations', () => {
    it('should return paginated conversations', async () => {
      const expected = {
        conversations: [
          {
            conversationId: '233537776709',
            phoneNumber: '233537776709',
            customerName: 'John Doe',
            lastMessage: 'Hello',
            unreadCount: 2,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      mockChatService.getConversations.mockResolvedValue(expected);

      const result = await controller.getConversations({
        page: 1,
        limit: 20,
        search: undefined,
      });

      expect(result).toEqual(expected);
      expect(mockChatService.getConversations).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        search: undefined,
      });
    });

    it('should pass search filter to service', async () => {
      mockChatService.getConversations.mockResolvedValue({
        conversations: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await controller.getConversations({
        page: 1,
        limit: 20,
        search: 'John',
      });

      expect(mockChatService.getConversations).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        search: 'John',
      });
    });
  });

  describe('GET /chat/conversations/:id/messages', () => {
    it('should return paginated messages', async () => {
      const expected = {
        messages: [
          {
            id: 'msg-1',
            direction: 'INBOUND',
            text: 'Hello',
            createdAt: new Date('2026-05-17T12:00:00Z'),
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };

      mockChatService.getConversationMessages.mockResolvedValue(expected);

      const result = await controller.getMessages('233537776709', {
        page: 1,
        limit: 50,
      });

      expect(result).toEqual(expected);
      expect(mockChatService.getConversationMessages).toHaveBeenCalledWith(
        '233537776709',
        { page: 1, limit: 50 },
      );
    });
  });

  describe('POST /chat/send', () => {
    it('should send a message and return result', async () => {
      const expected = {
        id: 'msg-1',
        direction: 'OUTBOUND',
        text: 'Hello customer',
        status: 'sent',
      };

      mockChatService.sendAdminReply.mockResolvedValue(expected);

      const result = await controller.sendMessage(
        { to: '233537776709', text: 'Hello customer' },
        { user: { id: 'user-1' } },
      );

      expect(result).toEqual(expected);
      expect(mockChatService.sendAdminReply).toHaveBeenCalledWith(
        { to: '233537776709', text: 'Hello customer' },
        'user-1',
      );
    });

    it('should use req.user.sub when req.user.id is not available', async () => {
      mockChatService.sendAdminReply.mockResolvedValue({});

      await controller.sendMessage(
        { to: '233500000000', text: 'Test' },
        { user: { sub: 'user-sub' } },
      );

      expect(mockChatService.sendAdminReply).toHaveBeenCalledWith(
        expect.anything(),
        'user-sub',
      );
    });
  });
});
