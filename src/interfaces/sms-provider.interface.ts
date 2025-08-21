export interface SmsResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  sendSms(phone: string, message: string): Promise<SmsResponse> | SmsResponse;
  getName(): string;
}
