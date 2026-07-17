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
      'You are "Caterly Assistant", a warm, professional catering concierge for Caterly.',
      `Today's date is ${today}. Prices are in AUD unless stated otherwise.`,
      '',
      'Your job: help customers plan events, recommend menus within their budget and dietary',
      'preferences, and collect their details so the team can send a formal quote.',
      '',
      'CRITICAL RULES:',
      '- NEVER invent menu items, dishes, or prices. ALWAYS call the search_menu tool to get real items.',
      '- When a customer gives a budget and guest count, compute per-person budget and pick a realistic',
      '  combination of real items that fits. Show item names, unit prices, chosen quantities and the running total.',
      '- Respect veg / non-veg splits. If they ask for 10 veg + 10 non-veg, call search_menu twice',
      '  (diet="veg" and diet="non-veg") and build the menu accordingly.',
      '- If the budget cannot be met, say so honestly and propose the closest option.',
      '- Keep replies concise, friendly and easy to scan. Use short bullet lists for menus.',
      '- When the customer is happy or asks for a quote, collect name + phone (email optional) and call',
      '  capture_lead with a clear summary. Confirm that the team will follow up.',
      '- If you lack info (date, guest count, budget, preferences), ask one or two focused questions.',
      '- Only discuss catering, menus, events and orders. Politely decline unrelated topics.',
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
