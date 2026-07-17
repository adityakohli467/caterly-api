import { Module } from '@nestjs/common';
import { StoreAiChatController } from './store-ai-chat.controller';
import { StoreAiChatService } from './store-ai-chat.service';
import { GrokService } from './grok.service';
import { AiToolsService } from './ai-tools.service';

@Module({
  controllers: [StoreAiChatController],
  providers: [StoreAiChatService, GrokService, AiToolsService],
})
export class StoreAiChatModule {}
