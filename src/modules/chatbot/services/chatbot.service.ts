import { Injectable, Logger } from '@nestjs/common';
import { ChatbotHandler } from '../interfaces/chatbot-handler.interface';
import { ChatbotInput } from '../interfaces/chatbot-input.interface';
import { ChatbotResponse } from '../interfaces/chatbot-output.interface';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private handlers: ChatbotHandler[] = [];

  register(handler: ChatbotHandler): void {
    this.handlers.push(handler);
    this.logger.log(`Registered chatbot handler: ${handler.id}`);
  }

  async handleInput(from: string, text: string): Promise<ChatbotResponse> {
    const input: ChatbotInput = { from, text };
    const handler = this.handlers.find((h) => h.canHandle(input));

    if (!handler) {
      this.logger.warn(
        `No handler found for input from ${from}, falling back to menu`,
      );
      return { type: 'menu' };
    }

    this.logger.debug(`Routing to handler: ${handler.id}`);
    return handler.handle(input);
  }
}
