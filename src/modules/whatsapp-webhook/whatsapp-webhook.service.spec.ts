import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { ChatbotService } from '../chatbot/services/chatbot.service';
import { ChatService } from '../chat/chat.service';

describe('WhatsAppWebhookService', () => {
  let service: WhatsAppWebhookService;
  let chatbotService: any;
  let chatService: any;
  let httpService: any;

  const mockConfig = {
    get: jest.fn(),
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockChatbotService = {
    handleInput: jest.fn(),
  };

  const mockChatService = {
    saveMessage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        WHATSAPP_ACCESS_TOKEN: 'test-token',
        WHATSAPP_PHONE_NUMBER_ID: 'test-phone-id',
        COMPANY_NAME: 'AOSTP Logistics',
      };
      return config[key] ?? defaultValue;
    });

    mockHttpService.post.mockReturnValue(
      of({
        data: {
          messages: [{ id: 'wa_reply_id' }],
        },
      }),
    );

    mockChatService.saveMessage.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppWebhookService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ChatbotService, useValue: mockChatbotService },
        { provide: ChatService, useValue: mockChatService },
      ],
    }).compile();

    service = module.get<WhatsAppWebhookService>(WhatsAppWebhookService);
    httpService = module.get(HttpService);
    chatbotService = module.get(ChatbotService);
    chatService = module.get(ChatService);
  });

  describe('handleTextMessage', () => {
    it('should persist inbound message, process via chatbot, persist outbound text reply', async () => {
      chatbotService.handleInput.mockResolvedValue({
        type: 'text',
        text: 'Package found: AOSTP-123',
      });

      await service.handleTextMessage('233537776709', 'AOSTP-123');

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: '233537776709',
          fromNumber: '233537776709',
          direction: 'INBOUND',
          text: 'AOSTP-123',
        }),
      );

      expect(chatbotService.handleInput).toHaveBeenCalledWith(
        '233537776709',
        'AOSTP-123',
      );

      expect(httpService.post).toHaveBeenCalled();
      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: '233537776709',
          direction: 'OUTBOUND',
          text: 'Package found: AOSTP-123',
          waMessageId: 'wa_reply_id',
        }),
      );
    });

    it('should persist inbound message and send interactive menu when chatbot returns menu type', async () => {
      chatbotService.handleInput.mockResolvedValue({
        type: 'menu',
      });

      await service.handleTextMessage('233537776709', 'help');

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'INBOUND',
          text: 'help',
        }),
      );

      expect(httpService.post).toHaveBeenCalled();
      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'OUTBOUND',
          messageType: 'interactive',
          text: 'Interactive menu sent',
        }),
      );
    });

    it('should persist inbound message and error reply when chatbot throws', async () => {
      chatbotService.handleInput.mockRejectedValue(
        new Error('Something broke'),
      );

      await service.handleTextMessage('233537776709', 'AOSTP-999');

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'INBOUND',
        }),
      );

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'OUTBOUND',
          text: 'Sorry, something went wrong. Please try again later.',
        }),
      );
    });

    it('should normalize phone numbers with leading zero', async () => {
      chatbotService.handleInput.mockResolvedValue({
        type: 'text',
        text: 'OK',
      });

      await service.handleTextMessage('0537776709', 'hello');

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: '233537776709',
        }),
      );
    });

    it('should normalize phone numbers with + prefix', async () => {
      chatbotService.handleInput.mockResolvedValue({
        type: 'text',
        text: 'OK',
      });

      await service.handleTextMessage('+233537776709', 'hello');

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: '233537776709',
        }),
      );
    });

    it('should handle missing WhatsApp credentials gracefully', async () => {
      (service as any).accessToken = '';
      (service as any).phoneNumberId = '';

      chatbotService.handleInput.mockResolvedValue({
        type: 'text',
        text: 'Some reply',
      });

      await service.handleTextMessage('233537776709', 'test');

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'INBOUND' }),
      );
      expect(httpService.post).not.toHaveBeenCalled();
      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'OUTBOUND',
          waMessageId: undefined,
        }),
      );
    });
  });

  describe('handleInteractiveReply', () => {
    it('should send TRACK prompt and persist both messages', async () => {
      await service.handleInteractiveReply('233537776709', 'TRACK');

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'INBOUND',
          messageType: 'interactive',
          text: 'List reply: TRACK',
        }),
      );

      expect(httpService.post).toHaveBeenCalled();
      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'OUTBOUND',
          text: '🔍 Please send your tracking code, invoice number, or intake code and I will look it up.',
        }),
      );
    });

    it('should send PHONE prompt and persist both messages', async () => {
      await service.handleInteractiveReply('233537776709', 'PHONE');

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'INBOUND',
          text: 'List reply: PHONE',
        }),
      );

      expect(httpService.post).toHaveBeenCalled();
      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'OUTBOUND',
          text: '📋 Please send your phone number so I can find your pending shipments.',
        }),
      );
    });

    it('should persist inbound but not send reply for unknown replyId', async () => {
      await service.handleInteractiveReply('233537776709', 'UNKNOWN');

      expect(chatService.saveMessage).toHaveBeenCalledTimes(1);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should normalize phone number', async () => {
      await service.handleInteractiveReply('0537776709', 'TRACK');

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: '233537776709',
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should send read receipt via Meta API', async () => {
      await service.markAsRead('wa_message_id_123');

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          status: 'read',
          message_id: 'wa_message_id_123',
        }),
        expect.any(Object),
      );
    });

    it('should skip if credentials are missing', async () => {
      (service as any).accessToken = '';
      (service as any).phoneNumberId = '';

      await service.markAsRead('wa_id');

      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should not throw on API error', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => ({
          response: { data: { error: { message: 'API error' } } },
        })),
      );

      await expect(service.markAsRead('bad_id')).resolves.not.toThrow();
    });
  });
});
