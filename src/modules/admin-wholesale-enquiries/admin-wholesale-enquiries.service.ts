import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminWholesaleEnquiriesService {
  private readonly logger = new Logger(AdminWholesaleEnquiriesService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * List all wholesale enquiries
   */
  async listWholesaleEnquiries(filters: {
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
        business_name,
        email,
        phone_number,
        business_address,
        suburb,
        state,
        postcode,
        business_license,
        business_website,
        weekly_volume,
        start_month,
        start_year,
        status,
        created_at,
        updated_at
      FROM wholesale_enquiries
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
        business_name ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        business_address ILIKE $${paramIndex}
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
      FROM wholesale_enquiries
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
        business_name ILIKE $${countParamIndex} OR
        email ILIKE $${countParamIndex} OR
        business_address ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return { enquiries: result, count };
  }

  /**
   * Get single wholesale enquiry
   */
  async getWholesaleEnquiry(id: number) {
    const query = `
      SELECT 
        id,
        first_name,
        last_name,
        business_name,
        email,
        phone_number,
        business_address,
        suburb,
        state,
        postcode,
        business_license,
        business_website,
        weekly_volume,
        start_month,
        start_year,
        status,
        created_at,
        updated_at
      FROM wholesale_enquiries
      WHERE id = $1
    `;

    const result = await this.dataSource.query(query, [Number(id)]);

    if (result.length === 0) {
      throw new NotFoundException('Wholesale enquiry not found');
    }

    return { enquiry: result[0] };
  }

  /**
   * Update wholesale enquiry status
   */
  async updateWholesaleEnquiry(id: number, status: string) {
    if (!status) {
      throw new BadRequestException('Status is required');
    }

    const query = `
      UPDATE wholesale_enquiries
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.dataSource.query(query, [status, Number(id)]);

    if (result.length === 0) {
      throw new NotFoundException('Wholesale enquiry not found');
    }

    return { enquiry: result[0] };
  }

  /**
   * Delete wholesale enquiry
   */
  async deleteWholesaleEnquiry(id: number) {
    const query = `DELETE FROM wholesale_enquiries WHERE id = $1 RETURNING *`;
    const result = await this.dataSource.query(query, [Number(id)]);

    if (result.length === 0) {
      throw new NotFoundException('Wholesale enquiry not found');
    }

    return { message: 'Wholesale enquiry deleted successfully' };
  }
}
