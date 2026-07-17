export interface ChatMessageDto {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatRequestDto {
  /** Full conversation so far (excluding the system prompt, which the server adds). */
  messages!: ChatMessageDto[];

  /** Optional opaque session id from the browser to group a conversation. */
  session_id?: string;
}

export interface ChatResponseDto {
  reply: string;
  /** Structured menu suggestion, if the AI produced one via tools. */
  suggestion?: any;
  session_id?: string;
}
