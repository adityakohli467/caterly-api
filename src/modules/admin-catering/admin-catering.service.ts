import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminCateringService {
  private readonly logger = new Logger(AdminCateringService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Get catering checklist
   */
  async getCateringChecklist(orderId: number) {
    const query = `
      SELECT * FROM catering_checklist 
      WHERE order_id = $1
    `;
    const result = await this.dataSource.query(query, [orderId]);
    return { checklist: result[0] || null };
  }

  /**
   * Create/Update catering checklist
   */
  async saveCateringChecklist(orderId: number, checklistData: any) {
    // Check if checklist exists
    const existingQuery = `
      SELECT * FROM catering_checklist 
      WHERE order_id = $1
    `;
    const existing = await this.dataSource.query(existingQuery, [orderId]);

    const dateUpdated = Math.floor(Date.now() / 1000);

    if (existing.length > 0) {
      // Update
      const updateQuery = `
        UPDATE catering_checklist 
        SET 
          ${Object.keys(checklistData)
            .map((key, index) => `${key} = $${index + 2}`)
            .join(', ')},
          date_updated = $1
        WHERE order_id = $${Object.keys(checklistData).length + 2}
        RETURNING *
      `;
      const params = [
        dateUpdated,
        ...Object.values(checklistData),
        orderId,
      ];
      const result = await this.dataSource.query(updateQuery, params);
      return {
        checklist: result[0],
        message: 'Catering checklist saved successfully',
      };
    } else {
      // Create
      const columns = ['order_id', 'date_updated', ...Object.keys(checklistData)];
      const values = [orderId, dateUpdated, ...Object.values(checklistData)];
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

      const insertQuery = `
        INSERT INTO catering_checklist (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;
      const result = await this.dataSource.query(insertQuery, values);

      return {
        checklist: result[0],
        message: 'Catering checklist saved successfully',
      };
    }
  }

  /**
   * List feedback
   */
  async listFeedback(filters: {
    limit?: number;
    offset?: number;
    location_id?: number;
  }) {
    const { limit = 20, offset = 0, location_id } = filters;

    let query = `
      SELECT 
        cf.*,
        o.order_id,
        o.order_total,
        o.delivery_date_time,
        l.location_id,
        l.location_name
      FROM customer_feedback cf
      LEFT JOIN orders o ON cf.order_id = o.order_id
      LEFT JOIN locations l ON cf.location_id = l.location_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (location_id) {
      query += ` AND cf.location_id = $${paramIndex}`;
      params.push(Number(location_id));
      paramIndex++;
    }

    query += ` ORDER BY cf.delivery_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const feedback = await this.dataSource.query(query, params);

    // Get count
    let countQuery = `
      SELECT COUNT(*) as count
      FROM customer_feedback cf
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (location_id) {
      countQuery += ` AND cf.location_id = $${countParamIndex}`;
      countParams.push(Number(location_id));
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return {
      feedback,
      count,
      limit: Number(limit),
      offset: Number(offset),
    };
  }

  /**
   * Get feedback
   */
  async getFeedback(id: number) {
    const query = `
      SELECT 
        cf.*,
        o.order_id,
        o.order_total,
        o.delivery_date_time,
        l.location_id,
        l.location_name
      FROM customer_feedback cf
      LEFT JOIN orders o ON cf.order_id = o.order_id
      LEFT JOIN locations l ON cf.location_id = l.location_id
      WHERE cf.feedback_id = $1
    `;

    const result = await this.dataSource.query(query, [Number(id)]);
    const feedback = result[0];

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    return { feedback };
  }

  /**
   * List surveys
   */
  async listSurveys(filters: {
    limit?: number;
    offset?: number;
    location_id?: number;
  }) {
    const { limit = 20, offset = 0, location_id } = filters;

    let query = `
      SELECT 
        s.*,
        l.location_id,
        l.location_name
      FROM survey s
      LEFT JOIN locations l ON s.location_id = l.location_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (location_id) {
      query += ` AND s.location_id = $${paramIndex}`;
      params.push(Number(location_id));
      paramIndex++;
    }

    query += ` ORDER BY s.date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const surveys = await this.dataSource.query(query, params);

    // Get count
    let countQuery = `
      SELECT COUNT(*) as count
      FROM survey s
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (location_id) {
      countQuery += ` AND s.location_id = $${countParamIndex}`;
      countParams.push(Number(location_id));
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return {
      surveys,
      count,
      limit: Number(limit),
      offset: Number(offset),
    };
  }
}
