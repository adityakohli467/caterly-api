import { IsArray, IsOptional, IsString } from 'class-validator';

export interface ChatMessageDto {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatRequestDto {
  /**
   * Full conversation so far (excluding the system prompt, which the server adds).
   * Decorated so the global ValidationPipe (whitelist: true) does not strip it.
   */
  @IsArray()
  messages!: ChatMessageDto[];

  /** Optional opaque session id from the browser to group a conversation. */
  @IsOptional()
  @IsString()
  session_id?: string;
}

export interface ChatResponseDto {
  reply: string;
  /** Structured menu suggestion, if the AI produced one via tools. */
  suggestion?: any;
  /** Priced quote (items + subtotal) the customer can add straight to the cart. */
  quote?: any;
  session_id?: string;
}
