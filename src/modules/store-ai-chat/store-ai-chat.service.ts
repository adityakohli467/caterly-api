import { Injectable, Logger } from '@nestjs/common';
import { GrokService } from './grok.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';

@Injectable()
export class StoreAiChatService {
  private readonly logger = new Logger(StoreAiChatService.name);

  constructor(private readonly grok: GrokService) {}

  async chat(dto: ChatRequestDto): Promise<ChatResponseDto> {
    const messages = Array.isArray(dto?.messages) ? dto.messages : [];

    // Keep only valid roles/content and cap length to protect against huge payloads.
    const cleaned = messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      .slice(-20);

    if (cleaned.length === 0) {
      return { reply: 'Hi! I can help you plan your event and build a menu within your budget. What are you celebrating?' };
    }

    const { reply, toolResults } = await this.grok.chat(cleaned);

    // Surface the last menu suggestion (if any) for the UI to render nicely.
    const lastMenu = [...toolResults].reverse().find((t) => t.tool === 'search_menu')?.result;
    // Surface the latest priced quote so the widget can offer "Add all to cart".
    const lastQuote = [...toolResults]
      .reverse()
      .find((t) => t.tool === 'build_quote' && Array.isArray(t.result?.items) && t.result.items.length > 0)?.result;
    const lead = toolResults.find((t) => t.tool === 'capture_lead')?.result;

    return {
      reply,
      suggestion: lastMenu || undefined,
      quote: lastQuote || undefined,
      session_id: dto.session_id,
      ...(lead ? { lead } : {}),
    } as ChatResponseDto;
  }
}
