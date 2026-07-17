import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AiToolsService } from './ai-tools.service';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

@Injectable()
export class GrokService {
  private readonly logger = new Logger(GrokService.name);

  // Works with any OpenAI-compatible provider. Defaults target Groq (groq.com).
  // For xAI Grok instead, set AI_BASE_URL=https://api.x.ai/v1 and AI_MODEL=grok-4.
  private readonly apiKey = process.env.AI_API_KEY || process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '';
  private readonly baseUrl = process.env.AI_BASE_URL || process.env.GROK_BASE_URL || 'https://api.groq.com/openai/v1';
  private readonly model = process.env.AI_MODEL || process.env.GROK_MODEL || 'llama-3.3-70b-versatile';

  constructor(private readonly tools: AiToolsService) {}

  private systemPrompt(): string {
    const today = new Date().toISOString().slice(0, 10);
    return [
      'You are Bizzy, the friendly human-like catering concierge for Caterly. You chat exactly like a warm,',
      'switched-on events coordinator would over live chat — natural, personable and genuinely helpful.',
      `Today is ${today}. Prices are in AUD.`,
      '',
      'HOW YOU TALK:',
      '- Sound like a real person, never a robot. Vary your wording; NEVER repeat the same sentence twice.',
      '- Never re-introduce yourself or repeat the welcome message after the first turn. Just continue the conversation.',
      '- Be concise and conversational. Use contractions ("I\'ll", "let\'s", "you\'re").',
      '- React to what they said ("A wedding, lovely!" / "Nice, a corporate lunch — easy."). Show a little warmth and personality.',
      '- Ask ONE natural follow-up at a time when you need info — do not interrogate with a wall of questions.',
      '- Use short bullet points only when presenting a menu or a price breakdown. Otherwise write like a chat.',
      '- A single tasteful emoji is fine occasionally; do not overdo it.',
      '',
      'YOUR JOB:',
      '- Help plan events and recommend menus within budget and dietary needs, then collect their details for a quote.',
      '',
      'HARD RULES:',
      '- NEVER invent menu items, dishes or prices. ALWAYS call search_menu to get real items before recommending anything.',
      '- Given a budget + guest count, work out the per-person budget and pick a realistic combination of REAL items that fits.',
      '  Show item names, unit prices, chosen quantities and the running total.',
      '- Respect ANY dietary preference or restriction the customer mentions — vegetarian, vegan, gluten-free, halal, nut/dairy',
      '  allergies, kids meals, and so on. Do not assume; ask if it matters. Pass what they said into search_menu\'s "dietary"',
      '  field (and set vegetarian_only only when they specifically want strictly vegetarian). If they want a split (e.g. some',
      '  guests one way and some another), search for each group separately and build the menu accordingly.',
      '- If the budget can\'t be met, say so kindly and offer the closest sensible option.',
      '- When they\'re happy or ask for a quote, collect their name + phone (email optional) and call capture_lead with a clear',
      '  summary, then reassure them the team will follow up shortly.',
      '- Only discuss catering, menus, events and orders. Politely steer back if they drift off-topic.',
    ].join('\n');
  }

  /**
   * Runs a full chat turn, resolving any tool calls, and returns the assistant reply.
   */
  async chat(history: { role: 'user' | 'assistant'; content: string }[]): Promise<{ reply: string; toolResults: any[] }> {
    if (!this.apiKey) {
      return {
        reply:
          'The assistant is not configured yet (missing AI_API_KEY). Please add the key to the API environment.',
        toolResults: [],
      };
    }

    const messages: GrokMessage[] = [
      { role: 'system', content: this.systemPrompt() },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    const toolDefs = this.tools.getToolDefinitions();
    const collectedToolResults: any[] = [];

    // Allow a few rounds of tool calls before forcing a final answer.
    for (let round = 0; round < 5; round++) {
      const response = await this.callGrok(messages, toolDefs);
      const choice = response?.choices?.[0];
      const msg = choice?.message;

      if (!msg) {
        return { reply: 'Sorry, I had trouble responding just now. Please try again.', toolResults: collectedToolResults };
      }

      // No tool calls -> final answer.
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return { reply: msg.content || '', toolResults: collectedToolResults };
      }

      // Append the assistant message that requested the tools.
      messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls });

      // Execute each requested tool and feed results back.
      for (const call of msg.tool_calls) {
        const fnName = call.function?.name;
        let args: any = {};
        try {
          args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = {};
        }

        const result = await this.tools.runTool(fnName, args);
        collectedToolResults.push({ tool: fnName, args, result });

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: fnName,
          content: JSON.stringify(result),
        });
      }
    }

    // Safety net: ask for a final summary without tools.
    const finalResp = await this.callGrok(messages, undefined);
    const finalMsg = finalResp?.choices?.[0]?.message?.content;
    return {
      reply: finalMsg || 'Here is what I found. Would you like me to put together a quote?',
      toolResults: collectedToolResults,
    };
  }

  private async callGrok(messages: GrokMessage[], tools?: any[]): Promise<any> {
    try {
      const body: any = {
        model: this.model,
        messages,
        temperature: 0.4,
      };
      if (tools && tools.length) {
        body.tools = tools;
        body.tool_choice = 'auto';
      }

      const { data } = await axios.post(`${this.baseUrl}/chat/completions`, body, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });
      return data;
    } catch (err: any) {
      this.logger.error(
        `Grok API call failed: ${err?.response?.status} ${JSON.stringify(err?.response?.data || err?.message)}`,
      );
      throw err;
    }
  }
}
