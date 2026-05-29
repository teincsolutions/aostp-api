import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  async getConversations(@Query() query: ConversationQueryDto) {
    return this.chatService.getConversations(query);
  }

  @Get('conversations/:id/messages')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  async getMessages(
    @Param('id') conversationId: string,
    @Query() query: MessagesQueryDto,
  ) {
    return this.chatService.getConversationMessages(conversationId, query);
  }

  @Get('unread-count')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  async getUnreadCount() {
    const total = await this.chatService.getUnreadCount();
    return { total };
  }

  @Post('media/signed-urls')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  @HttpCode(HttpStatus.OK)
  async getSignedMediaUrls(
    @Body() body: { items: { key: string; bucket?: string }[] },
  ) {
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      throw new BadRequestException('items array is required');
    }
    return this.chatService.getSignedMediaUrls(body.items);
  }

  @Post('send')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() dto: SendMessageDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.chatService.sendAdminReply(dto, userId);
  }
}
