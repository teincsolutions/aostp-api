import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatOutboxProcessor } from './chat-outbox.processor';
import { StorageModule } from '../../providers/storage/storage.module';

@Module({
  imports: [
    HttpModule,
    StorageModule,
    BullModule.registerQueue({
      name: 'chat-outbox',
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ChatOutboxProcessor],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
