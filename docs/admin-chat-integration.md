# Admin Chat — Frontend Integration Guide

## Overview

The admin chat system mirrors WhatsApp Business chat features. Admins can view all customer conversations, see real-time messages as they arrive, view message history, and send replies (text, image, document, audio, video).

```
Base URL: https://api.akomapacargo.com/api/v1
WebSocket: wss://api.akomapacargo.com/chat
```

---

## 1. Authentication

All chat endpoints require JWT auth with role `SUPER_ADMIN`, `OPERATIONS_CLERK`, or `FINANCE_MANAGER`.

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@company.com",
  "password": "********"
}
```

**Response (201):**

```json
{
  "status": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJl...",
    "user": {
      "id": "uuid",
      "email": "admin@company.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "SUPER_ADMIN"
    }
  }
}
```

### Using the token

```http
GET /api/v1/chat/conversations
Authorization: Bearer <accessToken>
```

### Refresh token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refreshToken>"
}
```

---

## 2. Conversations

### List all conversations

```http
GET /api/v1/chat/conversations?page=1&limit=20&search=23353
```

**Query Parameters:**

| Param    | Type   | Default | Description                              |
| -------- | ------ | ------- | ---------------------------------------- |
| `page`   | number | 1       | Page number                              |
| `limit`  | number | 20      | Items per page (max 100)                 |
| `search` | string | —       | Filters by phone number (partial match)  |

**Response (200):**

```json
{
  "status": true,
  "data": {
    "conversations": [
      {
        "conversationId": "233537776709",
        "phoneNumber": "233537776709",
        "customerName": "John Doe",
        "customerCode": "CUST-001",
        "lastMessage": "My tracking code is AOSTP-123",
        "lastMessageAt": "2026-05-20T10:01:00.000Z",
        "lastDirection": "INBOUND",
        "unreadCount": 2
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Notes:**
- Conversations are sorted newest-last-message-first
- `unreadCount` = number of inbound messages not yet read by any admin
- `customerName`/`customerCode` resolved automatically from customer records by phone number suffix
- Conversations without a matching customer record return `null` for customer fields

---

## 3. Messages

### View conversation messages

```http
GET /api/v1/chat/conversations/233537776709/messages?page=1&limit=50
```

**Query Parameters:**

| Param   | Type   | Default | Description              |
| ------- | ------ | ------- | ------------------------ |
| `page`  | number | 1       | Page number              |
| `limit` | number | 50      | Items per page (max 100) |

**Response (200):**

```json
{
  "status": true,
  "data": {
    "messages": [
      {
        "id": "uuid",
        "direction": "INBOUND",
        "messageType": "text",
        "text": "My tracking code is AOSTP-123",
        "status": "sent",
        "waMessageId": "wamid.abc123",
        "readAt": "2026-05-20T10:05:00.000Z",
        "createdAt": "2026-05-20T10:01:00.000Z",
        "repliedBy": null
      },
      {
        "id": "uuid",
        "direction": "OUTBOUND",
        "messageType": "text",
        "text": "Thanks! Your package is in transit.",
        "status": "sent",
        "waMessageId": "wamid.def456",
        "readAt": null,
        "createdAt": "2026-05-20T10:02:00.000Z",
        "repliedBy": {
          "id": "uuid",
          "firstName": "Admin",
          "lastName": "User"
        }
      },
      {
        "id": "uuid",
        "direction": "OUTBOUND",
        "messageType": "image",
        "text": "Delivery photo attached",
        "status": "sent",
        "waMessageId": "wamid.ghi789",
        "readAt": null,
        "createdAt": "2026-05-20T10:03:00.000Z",
        "repliedBy": {
          "id": "uuid",
          "firstName": "Admin",
          "lastName": "User"
        }
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

**`messageType` values:**

| Type       | Description                      |
| ---------- | -------------------------------- |
| `text`     | Plain text message               |
| `image`    | Image with optional caption      |
| `document` | File with filename and caption   |
| `audio`    | Audio message                    |
| `video`    | Video with optional caption      |
| `interactive` | WhatsApp list reply (chatbot) |

**Important:** Fetching messages marks all inbound messages in that conversation as read (`readAt` is set). This automatically updates the `unreadCount` returned by the conversations endpoint.

---

## 4. Sending Replies

### Send a text reply

```http
POST /api/v1/chat/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "233537776709",
  "text": "Your package is in transit and will arrive on June 15th."
}
```

### Send an image reply

```http
POST /api/v1/chat/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "233537776709",
  "type": "image",
  "mediaUrl": "https://s3.amazonaws.com/uploads/delivery-photo.jpg",
  "text": "Here is your delivery photo"
}
```

### Send a document reply

```http
POST /api/v1/chat/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "233537776709",
  "type": "document",
  "mediaUrl": "https://s3.amazonaws.com/uploads/invoice.pdf",
  "filename": "invoice-2026-001.pdf",
  "text": "Your invoice is attached"
}
```

### Send an audio reply

```http
POST /api/v1/chat/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "233537776709",
  "type": "audio",
  "mediaUrl": "https://s3.amazonaws.com/uploads/voice-note.mp3"
}
```

### Send a video reply

```http
POST /api/v1/chat/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "233537776709",
  "type": "video",
  "mediaUrl": "https://s3.amazonaws.com/uploads/delivery-video.mp4",
  "text": "Unboxing video"
}
```

### Request body schema

| Field       | Type   | Required         | Description                                                |
| ----------- | ------ | ---------------- | ---------------------------------------------------------- |
| `to`        | string | yes              | Customer phone number (any format, normalized server-side) |
| `type`      | string | no (default: `text`) | One of: `text`, `image`, `document`, `audio`, `video`  |
| `text`      | string | yes (for text)   | Message body (text) or caption (media)                     |
| `mediaUrl`  | string | yes (for media)  | Publicly accessible URL to the media file                  |
| `filename`  | string | yes (for document) | Filename for document messages (e.g., `invoice.pdf`)     |

### Response (200)

```json
{
  "status": true,
  "message": "Message sent successfully",
  "data": {
    "id": "uuid",
    "conversationId": "233537776709",
    "fromNumber": "15551234567",
    "toNumber": "233537776709",
    "direction": "OUTBOUND",
    "messageType": "image",
    "text": "Here is your delivery photo",
    "content": {
      "mediaUrl": "https://s3.amazonaws.com/uploads/delivery-photo.jpg"
    },
    "status": "sent",
    "waMessageId": "wamid.msg123",
    "repliedBy": {
      "id": "uuid",
      "firstName": "Admin",
      "lastName": "User"
    },
    "createdAt": "2026-05-20T10:05:00.000Z"
  }
}
```

### Sending to WhatsApp limitations

- **Images:** max 5 MB, JPEG/PNG
- **Documents:** max 100 MB, PDF/DOC/XLS/PPT
- **Audio:** max 16 MB, AAC/AMR/MP3
- **Video:** max 16 MB, MP4/3GPP
- `mediaUrl` must be publicly accessible (WhatsApp fetches the file from the URL)

---

## 5. WebSocket — Live Updates

The WebSocket provides real-time updates. Connect to the `/chat` namespace.

### Connection

```js
import { io } from 'socket.io-client';

const socket = io('https://api.akomapacargo.com/chat', {
  transports: ['websocket'],
  // No auth token needed for WebSocket (must be behind same auth as API in production)
});
```

### Events

#### `new-message`

Emitted when any message is created (inbound webhook or admin reply).

```json
{
  "id": "uuid",
  "conversationId": "233537776709",
  "fromNumber": "233537776709",
  "toNumber": "15551234567",
  "direction": "INBOUND",
  "text": "Where is my package?",
  "messageType": "text",
  "status": "sent",
  "createdAt": "2026-05-20T10:05:00.000Z",
  "repliedBy": null
}
```

For admin replies, `repliedBy` is populated:

```json
{
  "repliedBy": {
    "id": "uuid",
    "firstName": "Admin",
    "lastName": "User"
  }
}
```

### Client usage example

```js
socket.on('new-message', (message) => {
  // Update the conversations list
  if (message.direction === 'INBOUND') {
    // Move conversation to top, increment unread
  }
  // Append to the active conversation's messages array
  if (activeConversationId === message.conversationId) {
    prependMessage(message);
  }
});
```

### Disconnection handling

```js
socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server closed, reconnect
    socket.connect();
  }
});
```

---

## 6. React Integration Examples

### Hook: useConversations

```ts
import { useState, useEffect, useCallback } from 'react';
import api from './api'; // your axios instance with auth interceptor

interface Conversation {
  conversationId: string;
  phoneNumber: string;
  customerName: string | null;
  customerCode: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastDirection: 'INBOUND' | 'OUTBOUND' | null;
  unreadCount: number;
}

interface PaginatedResult {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useConversations() {
  const [data, setData] = useState<PaginatedResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (page = 1, search?: string) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      const res = await api.get('/chat/conversations', { params });
      setData(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, fetch };
}
```

### Hook: useMessages

```ts
import { useState, useEffect, useCallback } from 'react';
import api from './api';

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  messageType: string;
  text: string | null;
  status: string;
  waMessageId: string | null;
  readAt: string | null;
  createdAt: string;
  repliedBy: { id: string; firstName: string; lastName: string } | null;
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (page = 1) => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const res = await api.get(
        `/chat/conversations/${conversationId}/messages`,
        { params: { page, limit: 50 } },
      );
      setMessages(res.data.data.messages);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  return { messages, loading, fetch };
}
```

### Hook: useChatSocket

```ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = 'https://api.akomapacargo.com/chat';

export function useChatSocket(handlers: {
  onNewMessage: (msg: any) => void;
}) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(WS_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('new-message', handlers.onNewMessage);

    return () => {
      socket.off('new-message');
      socket.disconnect();
    };
  }, [handlers.onNewMessage]);

  return socketRef;
}
```

### Hook: sendReply

```ts
import { useState } from 'react';
import api from './api';

interface SendReplyParams {
  to: string;
  type?: 'text' | 'image' | 'document' | 'audio' | 'video';
  text?: string;
  mediaUrl?: string;
  filename?: string;
}

export function useSendReply() {
  const [sending, setSending] = useState(false);

  const send = async (params: SendReplyParams) => {
    setSending(true);
    try {
      const res = await api.post('/chat/send', params);
      return res.data.data;
    } finally {
      setSending(false);
    }
  };

  return { send, sending };
}
```

### Chat view component (putting it together)

```tsx
function ChatView() {
  const { data: conversations, fetch: fetchConvos } = useConversations();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const { messages, fetch: fetchMessages } = useMessages(activeConvId);
  const { send, sending } = useSendReply();

  // Listen for live updates
  useChatSocket({
    onNewMessage: (msg) => {
      fetchConvos(); // refresh conversation list
      if (msg.conversationId === activeConvId) {
        fetchMessages(); // refresh messages
      }
    },
  });

  const handleSend = async (text: string) => {
    if (!activeConvId) return;
    await send({ to: activeConvId, text });
    fetchMessages();
  };

  return (
    <div className="chat-layout">
      {/* Conversation list */}
      <aside>
        {conversations?.conversations.map((conv) => (
          <div
            key={conv.conversationId}
            onClick={() => setActiveConvId(conv.conversationId)}
            className={conv.conversationId === activeConvId ? 'active' : ''}
          >
            <strong>{conv.customerName || conv.phoneNumber}</strong>
            <span>{conv.lastMessage}</span>
            {conv.unreadCount > 0 && <badge>{conv.unreadCount}</badge>}
          </div>
        ))}
      </aside>

      {/* Message area */}
      <main>
        <MessageList messages={messages} />
        <MessageInput onSend={handleSend} disabled={sending} />
      </main>
    </div>
  );
}
```

---

## 7. Error Handling

All errors return a consistent shape:

```json
{
  "status": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

| Status | Error                     | Cause                                |
| ------ | ------------------------- | ------------------------------------ |
| 401    | Unauthorized              | Missing or expired JWT token         |
| 403    | Forbidden                 | User role lacks permission           |
| 422    | Validation Error          | Missing required fields in request   |
| 429    | Too Many Requests         | Rate limit exceeded                  |
| 500    | Internal Server Error     | Unexpected server error              |

Rate limit: **10 requests per 60 seconds** per IP (global throttle).

---

## 8. Architecture Overview

```
Frontend (React)                    Backend (NestJS)                WhatsApp Cloud API
─────────────                      ──────────────                 ─────────────────
      │                                   │                              │
      │── POST /auth/login ──────────────►│                              │
      │◄── { accessToken } ──────────────│                              │
      │                                   │                              │
      │── GET /chat/conversations ───────►│                              │
      │◄── { conversations[] } ──────────│                              │
      │                                   │                              │
      │── GET /chat/conversations/:id/messages ──►│                     │
      │◄── { messages[] } ───────────────│                              │
      │                                   │                              │
      │── POST /chat/send ───────────────►│── POST /messages ──────────►│
      │◄── { message } ──────────────────│◄── { messageId } ───────────│
      │                                   │                              │
      │── connect ws://.../chat ─────────►│                              │
      │                                   │                              │
      │   (customer sends message)        │◄── POST /webhook/whatsapp ──│
      │◄── new-message event ────────────│                              │
```
