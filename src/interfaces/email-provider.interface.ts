export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  sendEmail(
    to: string,
    subject: string,
    content: string,
    options?: EmailOptions,
  ): Promise<EmailResponse> | EmailResponse;
  getName(): string;
}

export interface EmailOptions {
  from?: string;
  cc?: string[];
  bcc?: string[];
  html?: boolean;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: string;
}
