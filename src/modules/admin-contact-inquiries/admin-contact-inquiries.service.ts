import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminContactInquiriesService {
  private readonly logger = new Logger(AdminContactInquiriesService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * List all contact inquiries
   */
  async listContactInquiries(filters: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const { status, search, limit = 100, offset = 0 } = filters;

    let query = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        phone_number,
        message,
        status,
        created_at,
        updated_at
      FROM contact_inquiries
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by status
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Search filter
    if (search) {
      query += ` AND (
        first_name ILIKE $${paramIndex} OR
        last_name ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        message ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as count
      FROM contact_inquiries
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (status) {
      countQuery += ` AND status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (
        first_name ILIKE $${countParamIndex} OR
        last_name ILIKE $${countParamIndex} OR
        email ILIKE $${countParamIndex} OR
        message ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return { inquiries: result, count };
  }

  /**
   * Get single contact inquiry
   */
  async getContactInquiry(id: number) {
    const query = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        phone_number,
        message,
        status,
        created_at,
        updated_at
      FROM contact_inquiries
      WHERE id = $1
    `;

    const result = await this.dataSource.query(query, [Number(id)]);

    if (result.length === 0) {
      throw new NotFoundException('Contact inquiry not found');
    }

    return { inquiry: result[0] };
  }

  /**
   * Update contact inquiry status
   */
  async updateContactInquiry(id: number, status: string) {
    if (!status) {
      throw new BadRequestException('Status is required');
    }

    const query = `
      UPDATE contact_inquiries
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.dataSource.query(query, [status, Number(id)]);

    if (result.length === 0) {
      throw new NotFoundException('Contact inquiry not found');
    }

    return { inquiry: result[0] };
  }

  /**
   * Delete contact inquiry
   */
  async deleteContactInquiry(id: number) {
    const query = `DELETE FROM contact_inquiries WHERE id = $1 RETURNING *`;
    const result = await this.dataSource.query(query, [Number(id)]);

    if (result.length === 0) {
      throw new NotFoundException('Contact inquiry not found');
    }

    return { message: 'Contact inquiry deleted successfully' };
  }
}
