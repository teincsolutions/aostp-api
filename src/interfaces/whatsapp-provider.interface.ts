export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface TemplateParameter {
  type: 'text';
  text: string;
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: TemplateParameter[];
}

export interface TemplateMessage {
  name: string;
  language: {
    code: string;
  };
  components: TemplateComponent[];
}

export interface WhatsAppProvider {
  sendMessage(
    phone: string,
    message: string,
  ): Promise<WhatsAppResponse> | WhatsAppResponse;

  sendTemplateMessage(
    phone: string,
    template: TemplateMessage,
  ): Promise<WhatsAppResponse> | WhatsAppResponse;

  getName(): string;
}
