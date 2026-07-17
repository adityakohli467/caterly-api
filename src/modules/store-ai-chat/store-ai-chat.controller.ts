import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StoreAiChatService } from './store-ai-chat.service';
import { ChatRequestDto } from './dto/chat.dto';

@ApiTags('Store AI Chat')
@Controller('store/ai-chat')
export class StoreAiChatController {
  constructor(private readonly service: StoreAiChatService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat with the Caterly AI catering assistant' })
  async chat(@Body() body: ChatRequestDto) {
    return this.service.chat(body);
  }
}
