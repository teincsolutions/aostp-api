import { HttpException, HttpStatus } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';

describe('WhatsAppWebhookController', () => {
  let controller: WhatsAppWebhookController;
  let configService: { get: jest.Mock };
  let webhookService: {
    markAsRead: jest.Mock;
    handleTextMessage: jest.Mock;
    handleInteractiveReply: jest.Mock;
  };

  const appSecret = 'test-app-secret';

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, string> = {
          WHATSAPP_VERIFY_TOKEN: 'verify-token',
          WHATSAPP_APP_SECRET: appSecret,
        };
        return values[key] ?? defaultValue;
      }),
    };

    webhookService = {
      markAsRead: jest.fn().mockResolvedValue(undefined),
      handleTextMessage: jest.fn().mockResolvedValue(undefined),
      handleInteractiveReply: jest.fn().mockResolvedValue(undefined),
    };

    controller = new WhatsAppWebhookController(
      configService as any,
      webhookService as any,
    );
  });

  const signPayload = (rawBody: Buffer): string => {
    const digest = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    return `sha256=${digest}`;
  };

  it('should process webhook when signature is valid', async () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'wamid.123',
                    from: '233537776709',
                    type: 'text',
                    text: { body: 'hello' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = signPayload(rawBody);

    const result = await controller.handleIncoming(
      body,
      { rawBody } as any,
      signature,
    );

    expect(result).toEqual({ status: 'ok' });
    expect(webhookService.markAsRead).toHaveBeenCalledWith('wamid.123');
    expect(webhookService.handleTextMessage).toHaveBeenCalledWith(
      '233537776709',
      'hello',
    );
  });

  it('should reject webhook when signature header is missing', async () => {
    const body = { entry: [] };
    const rawBody = Buffer.from(JSON.stringify(body));

    await expect(
      controller.handleIncoming(body, { rawBody } as any, undefined),
    ).rejects.toThrow(HttpException);

    await expect(
      controller.handleIncoming(body, { rawBody } as any, undefined),
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('should reject webhook when signature is invalid', async () => {
    const body = { entry: [] };
    const rawBody = Buffer.from(JSON.stringify(body));

    await expect(
      controller.handleIncoming(body, { rawBody } as any, 'sha256=invalid'),
    ).rejects.toThrow(HttpException);

    await expect(
      controller.handleIncoming(body, { rawBody } as any, 'sha256=invalid'),
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });
});
