import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import { AiToolsService } from './ai-tools.service';

interface GrokMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

// Known-good Groq model with tool-calling support, used as a safety net if the
// configured AI_MODEL is invalid/decommissioned (Groq returns 400 in that case).
const FALLBACK_MODEL = 'llama-3.3-70b-versatile';

@Injectable()
export class GrokService implements OnModuleInit {
  private readonly logger = new Logger(GrokService.name);

  // Works with any OpenAI-compatible provider. Defaults target Groq (groq.com).
  // For xAI Grok instead, set AI_BASE_URL=https://api.x.ai/v1 and AI_MODEL=grok-4.
  private readonly apiKey = process.env.AI_API_KEY || process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '';
  private readonly baseUrl = process.env.AI_BASE_URL || process.env.GROK_BASE_URL || 'https://api.groq.com/openai/v1';
  private model = process.env.AI_MODEL || process.env.GROK_MODEL || 'llama-3.3-70b-versatile';

  constructor(private readonly tools: AiToolsService) {}

  onModuleInit() {
    const keyState = this.apiKey ? `set (…${this.apiKey.slice(-4)})` : 'MISSING';
    this.logger.log(`AI assistant config -> model="${this.model}", base="${this.baseUrl}", apiKey=${keyState}`);
  }

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
      '- As soon as you have put together a menu you would recommend, call build_quote with those exact product_id values',
      '  and quantities BEFORE writing your reply. This is what renders the "Add all items to cart" button with real prices.',
      '- NEVER ask "would you like me to build a quote?" or wait for permission. Building the quote is free and non-committal —',
      '  just do it every time you propose a menu, then present the menu in your own words. If they tweak it, call build_quote',
      '  again with the updated items. Only skip build_quote if you have not settled on any specific dishes yet.',
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

    try {
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
        messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });

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
    } catch (err: any) {
      const status = err?.response?.status;
      const providerMsg = err?.response?.data?.error?.message || err?.message;
      this.logger.error(
        `AI provider error (model="${this.model}", base="${this.baseUrl}", status=${status}): ${providerMsg}`,
      );
      // Degrade gracefully instead of returning a 500 to the browser.
      return {
        reply:
          "Sorry, I'm having a little trouble right now. Please try again in a moment, or reach out to our team and we'll help you plan your event.",
        toolResults: collectedToolResults,
      };
    }
  }

  private async callGrok(messages: GrokMessage[], tools?: any[]): Promise<any> {
    const maxAttempts = 4;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.postCompletion(this.model, messages, tools);
      } catch (err: any) {
        const status = err?.response?.status;
        const data = err?.response?.data?.error;
        const providerMsg = data?.message || err?.message || '';
        const code = data?.code;

        // If the configured model is invalid/unsupported, fall back to a known-good one and retry.
        const looksLikeModelProblem =
          (status === 400 || status === 404) &&
          this.model !== FALLBACK_MODEL &&
          /model|decommission|not found|does not exist|unsupported|invalid/i.test(String(providerMsg));

        if (looksLikeModelProblem) {
          this.logger.warn(`Falling back from model "${this.model}" to "${FALLBACK_MODEL}" and retrying.`);
          this.model = FALLBACK_MODEL;
          continue;
        }

        // Rate limited (Groq free-tier tokens/requests per minute). Wait the suggested
        // amount of time and retry instead of failing the whole conversation.
        if (status === 429 && attempt < maxAttempts) {
          const waitMs = this.parseRetryAfterMs(err);
          this.logger.warn(`Rate limited (attempt ${attempt}/${maxAttempts}); retrying in ${waitMs}ms.`);
          await this.sleep(waitMs);
          continue;
        }

        // The model occasionally emits a malformed tool call and Groq rejects it with
        // "tool_use_failed". This is stochastic, so retry a couple of times; as a last
        // resort, recover the intended call from failed_generation so the chat still progresses.
        if (status === 400 && code === 'tool_use_failed') {
          this.logger.warn(`tool_use_failed (attempt ${attempt}/${maxAttempts}); retrying.`);
          if (attempt < maxAttempts) {
            await this.sleep(300);
            continue;
          }

          const recovered = this.recoverToolCall(data?.failed_generation);
          if (recovered) {
            this.logger.warn('Recovered tool call from failed_generation after retries.');
            return recovered;
          }
        }

        this.logger.error(`AI call failed (model="${this.model}", status=${status}, code=${code}): ${providerMsg}`);
        throw err;
      }
    }

    throw new Error('AI call failed after retries.');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Work out how long to wait after a 429, from the Retry-After header or Groq's message. */
  private parseRetryAfterMs(err: any): number {
    const headerVal = err?.response?.headers?.['retry-after'];
    if (headerVal && !isNaN(Number(headerVal))) {
      return Math.min(Math.max(Number(headerVal) * 1000, 500), 10000);
    }

    // Groq messages look like: "Please try again in 2.13s."
    const msg: string = err?.response?.data?.error?.message || '';
    const m = msg.match(/try again in\s+([\d.]+)s/i);
    if (m) {
      return Math.min(Math.max(Math.ceil(parseFloat(m[1]) * 1000) + 200, 500), 10000);
    }

    return 2000;
  }

  /**
   * Rebuild a valid tool-call response from Groq's failed_generation payload, e.g.
   * `<function=search_menu={"keywords":"party"}</function>`, so a malformed generation
   * does not break the conversation.
   */
  private recoverToolCall(failed?: string): any | null {
    if (!failed || typeof failed !== 'string') return null;

    const match = failed.match(/<function=([a-zA-Z_][\w]*)=?\s*(\{[\s\S]*\})\s*<\/function>/);
    if (!match) return null;

    const name = match[1];
    const args = match[2];
    try {
      JSON.parse(args);
    } catch {
      return null;
    }

    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: `recovered_${Date.now()}`,
                type: 'function',
                function: { name, arguments: args },
              },
            ],
          },
        },
      ],
    };
  }

  private async postCompletion(model: string, messages: GrokMessage[], tools?: any[]): Promise<any> {
    const body: any = { model, messages, temperature: 0.4 };
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
  }
}
