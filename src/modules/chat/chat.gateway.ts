import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

interface NewMessagePayload {
  id: string;
  conversationId: string;
  fromNumber: string;
  toNumber: string;
  direction: 'INBOUND' | 'OUTBOUND';
  text?: string | null;
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
}
