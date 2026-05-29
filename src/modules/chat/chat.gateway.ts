import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

interface NewMessagePayload {
  id: string;
  conversationId: string;
  fromNumber: string;
  toNumber: string;
  direction: 'INBOUND' | 'OUTBOUND';
  text?: string | null;
  content?: any;
  messageType: string;
  status: string;
  createdAt: Date;
  repliedBy?: { id: string; firstName: string; lastName: string } | null;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*', credentials: true },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  notifyNewMessage(message: NewMessagePayload): void {
    this.server.emit('new-message', message);
  }

  notifyUnreadCount(total: number): void {
    this.server.emit('unread-count', { total });
  }

  notifyMessageStatus(
    messageId: string,
    status: string,
    waMessageId?: string,
  ): void {
    this.server.emit('message-status', { messageId, status, waMessageId });
  }

  notifyMessagesDeleted(messageIds: string[]): void {
    this.server.emit('messages-deleted', { messageIds });
  }
}
