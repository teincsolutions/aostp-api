import { ChatbotInput } from './chatbot-input.interface';
import { ChatbotResponse } from './chatbot-output.interface';

export interface ChatbotHandler {
  readonly id: string;
  canHandle(input: ChatbotInput): boolean;
  handle(input: ChatbotInput): Promise<ChatbotResponse>;
}
