import { Injectable } from '@nestjs/common';
import { ChatbotHandler } from '../interfaces/chatbot-handler.interface';
import { ChatbotInput } from '../interfaces/chatbot-input.interface';
import { ChatbotResponse } from '../interfaces/chatbot-output.interface';

@Injectable()
export class HelpMenuHandler implements ChatbotHandler {
  readonly id = 'help-menu';

  canHandle(_input: ChatbotInput): boolean {
    return true;
  }

  handle(_input: ChatbotInput): Promise<ChatbotResponse> {
    return Promise.resolve({ type: 'menu' });
  }
}
