import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Tools the AI model is allowed to call. Each method runs a real, parameterised
 * SQL query against the live catalog so the model never invents menu items or prices.
 */
@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * JSON schema definitions passed to Grok so it knows which tools exist.
   */
  getToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'search_menu',
          description:
            'Search the live catering catalog for items. Use this before recommending any dish so prices and names are real. Returns matching products with price, category and the vegetarian flag.',
          parameters: {
            type: 'object',
            properties: {
              keywords: {
                type: 'string',
                description: 'Optional free-text dish keywords, e.g. "biryani grilled chicken salad".',
              },
              dietary: {
                type: 'string',
                description:
                  'Any dietary preference or restriction the customer mentioned, matched against item name/description/tags. Free text — e.g. "vegan", "gluten free", "halal", "nut free", "dairy free", "vegetarian", "kids". Leave empty if none.',
              },
              vegetarian_only: {
                type: 'boolean',
                description:
                  'Set true ONLY when the customer explicitly wants strictly vegetarian items (uses the structured vegetarian flag). Otherwise omit.',
              },
              max_price: {
                type: 'number',
                description: 'Maximum unit price to include.',
              },
              min_price: {
                type: 'number',
                description: 'Minimum unit price to include.',
              },
              category: {
                type: 'string',
                description: 'Optional category name to filter by, e.g. "Starters", "Desserts".',
              },
              limit: {
                type: 'number',
                description: 'Max number of items to return (default 20, max 50).',
              },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_menu_categories',
          description: 'List available menu categories so you can guide the customer or build a balanced menu.',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      },
      {
        type: 'function',
        function: {
          name: 'capture_lead',
          description:
            'Save the customer enquiry / event request as a lead so the catering team can follow up. Call this once you have collected the essentials (name + contact) and the customer wants to proceed or get a quote.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Customer full name.' },
              email: { type: 'string', description: 'Customer email address.' },
              contact: { type: 'string', description: 'Customer phone number.' },
              event_date: { type: 'string', description: 'Event date/time as text, e.g. "22nd July 2026".' },
              guests: { type: 'number', description: 'Number of guests.' },
              occasion: { type: 'string', description: 'Type of occasion, e.g. "Birthday", "Corporate".' },
              summary: {
                type: 'string',
                description: 'A concise summary of the proposed menu, budget and any special requests (veg/non-veg split, allergies, etc.).',
              },
            },
            required: ['name', 'contact'],
          },
        },
      },
    ];
  }

  /** Dispatch a tool call by name. */
  async runTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'search_menu':
        return this.searchMenu(args || {});
      case 'get_menu_categories':
        return this.getMenuCategories();
      case 'capture_lead':
        return this.captureLead(args || {});
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  private async searchMenu(args: {
    keywords?: string;
    dietary?: string;
    vegetarian_only?: boolean;
    max_price?: number;
    min_price?: number;
    category?: string;
    limit?: number;
  }) {
    const params: any[] = [];
    let i = 1;

    let query = `
      SELECT
        p.product_id,
        p.product_name,
        p.product_price,
        COALESCE(p.is_vegetarian, false) AS is_vegetarian,
        p.short_description,
        p.product_tag,
        (
          SELECT c.category_name
          FROM product_category pc
          JOIN category c ON pc.category_id = c.category_id
          WHERE pc.product_id = p.product_id
          LIMIT 1
        ) AS category_name
      FROM product p
      WHERE p.product_status = 1
        AND p.show_in_storefront = true
        AND (p.is_healthy_choice = false OR p.is_healthy_choice IS NULL)
        AND LOWER(COALESCE(p.customer_type_visibility, 'all')) = 'all'
    `;

    if (args.keywords && args.keywords.trim()) {
      // Match ANY of the provided keywords in name or description.
      const words = args.keywords.trim().split(/\s+/).slice(0, 8);
      const clauses: string[] = [];
      for (const w of words) {
        params.push(`%${w}%`);
        clauses.push(`(p.product_name ILIKE $${i} OR p.product_description ILIKE $${i} OR p.short_description ILIKE $${i})`);
        i++;
      }
      if (clauses.length) query += ` AND (${clauses.join(' OR ')})`;
    }

    // Free-form dietary preference / restriction: match against name, description and tags.
    if (args.dietary && args.dietary.trim()) {
      const words = args.dietary.trim().split(/\s+/).slice(0, 6);
      const clauses: string[] = [];
      for (const w of words) {
        params.push(`%${w}%`);
        clauses.push(
          `(p.product_name ILIKE $${i} OR p.product_description ILIKE $${i} OR p.short_description ILIKE $${i} OR p.product_tag ILIKE $${i})`,
        );
        i++;
      }
      if (clauses.length) query += ` AND (${clauses.join(' OR ')})`;
    }

    // Structured vegetarian flag only when explicitly requested.
    if (args.vegetarian_only === true) {
      query += ` AND COALESCE(p.is_vegetarian, false) = true`;
    }

    if (typeof args.min_price === 'number' && !isNaN(args.min_price)) {
      params.push(args.min_price);
      query += ` AND p.product_price >= $${i}`;
      i++;
    }

    if (typeof args.max_price === 'number' && !isNaN(args.max_price)) {
      params.push(args.max_price);
      query += ` AND p.product_price <= $${i}`;
      i++;
    }

    if (args.category && args.category.trim()) {
      params.push(`%${args.category.trim()}%`);
      query += ` AND EXISTS (
        SELECT 1 FROM product_category pc
        JOIN category c ON pc.category_id = c.category_id
        WHERE pc.product_id = p.product_id AND c.category_name ILIKE $${i}
      )`;
      i++;
    }

    const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
    params.push(limit);
    query += ` ORDER BY p.product_price ASC LIMIT $${i}`;

    try {
      const rows = await this.dataSource.query(query, params);
      return {
        count: rows.length,
        items: rows.map((r: any) => ({
          product_id: r.product_id,
          name: r.product_name,
          price: Number(r.product_price),
          is_vegetarian: r.is_vegetarian === true,
          category: r.category_name || null,
          tags: r.product_tag || null,
          description: r.short_description || null,
        })),
      };
    } catch (err) {
      this.logger.error('search_menu failed', err as any);
      return { error: 'Menu search failed', count: 0, items: [] };
    }
  }

  private async getMenuCategories() {
    try {
      const rows = await this.dataSource.query(`
        SELECT category_id, category_name
        FROM category
        WHERE category_status = 1
        ORDER BY sort_order ASC, category_name ASC
        LIMIT 100
      `);
      return { categories: rows };
    } catch (err) {
      this.logger.error('get_menu_categories failed', err as any);
      return { categories: [] };
    }
  }

  private async captureLead(args: {
    name?: string;
    email?: string;
    contact?: string;
    event_date?: string;
    guests?: number;
    occasion?: string;
    summary?: string;
  }) {
    if (!args.name || !args.contact) {
      return { success: false, error: 'name and contact are required to save a lead.' };
    }

    const messageParts: string[] = [];
    if (args.guests) messageParts.push(`Guests: ${args.guests}`);
    if (args.summary) messageParts.push(args.summary);
    const message = messageParts.join('\n') || 'Enquiry via AI chatbot';

    try {
      const rows = await this.dataSource.query(
        `INSERT INTO quotation_inquiry
           (name, contact, email, delivery_date_time, occasion, message, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW())
         RETURNING id`,
        [
          args.name,
          args.contact,
          args.email || '',
          args.event_date || null,
          args.occasion || 'AI Chatbot Enquiry',
          message,
        ],
      );
      return { success: true, lead_id: rows?.[0]?.id ?? null };
    } catch (err) {
      this.logger.error('capture_lead failed', err as any);
      return { success: false, error: 'Could not save the enquiry.' };
    }
  }
}
