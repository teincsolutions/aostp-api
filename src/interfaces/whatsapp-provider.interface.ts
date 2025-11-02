export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  sendMessage(
    phone: string,
    message: string,
  ): Promise<WhatsAppResponse> | WhatsAppResponse;
  getName(): string;
}
