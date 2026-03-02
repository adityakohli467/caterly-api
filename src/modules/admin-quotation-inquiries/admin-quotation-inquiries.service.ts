import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminQuotationInquiriesService {
    private readonly logger = new Logger(AdminQuotationInquiriesService.name);

    constructor(private dataSource: DataSource) { }

    /**
     * List all quotation inquiries with pagination and filters
     */
    async findAllInquiries(filters: {
        status?: string;
        search?: string;
        limit?: number;
        offset?: number;
        date_from?: string;
        date_to?: string;
    }) {
        const { status, search, limit = 20, offset = 0, date_from, date_to } = filters;

        let query = `
      SELECT 
        id,
        name,
        contact,
        email,
        delivery_date_time,
        occasion,
        message,
        status,
        created_at,
        updated_at
      FROM quotation_inquiry
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
        name ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        message ILIKE $${paramIndex} OR
        occasion ILIKE $${paramIndex}
      )`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Date filters
        if (date_from) {
            query += ` AND created_at >= $${paramIndex}`;
            params.push(date_from);
            paramIndex++;
        }

        if (date_to) {
            query += ` AND created_at <= $${paramIndex}`;
            params.push(date_to);
            paramIndex++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(Number(limit), Number(offset));

        const result = await this.dataSource.query(query, params);

        // Get total count
        let countQuery = `
      SELECT COUNT(*) as count
      FROM quotation_inquiry
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
        name ILIKE $${countParamIndex} OR
        email ILIKE $${countParamIndex} OR
        message ILIKE $${countParamIndex} OR
        occasion ILIKE $${countParamIndex}
      )`;
            countParams.push(`%${search}%`);
            countParamIndex++;
        }

        if (date_from) {
            countQuery += ` AND created_at >= $${countParamIndex}`;
            countParams.push(date_from);
            countParamIndex++;
        }

        if (date_to) {
            countQuery += ` AND created_at <= $${countParamIndex}`;
            countParams.push(date_to);
            countParamIndex++;
        }

        const countResult = await this.dataSource.query(countQuery, countParams);
        const totalCount = parseInt(countResult[0].count);

        return {
            inquiries: result,
            count: totalCount,
            limit: Number(limit),
            offset: Number(offset)
        };
    }

    /**
     * Get single quotation inquiry details
     */
    async findOneInquiry(id: number) {
        const query = `
      SELECT 
        id,
        name,
        contact,
        email,
        delivery_date_time,
        occasion,
        message,
        status,
        created_at,
        updated_at
      FROM quotation_inquiry
      WHERE id = $1
    `;

        const result = await this.dataSource.query(query, [Number(id)]);

        if (result.length === 0) {
            throw new NotFoundException('Quotation inquiry not found');
        }

        return { inquiry: result[0] };
    }

    /**
     * Update quotation status (e.g., 'reviewed', 'quoted', 'declined')
     */
    async updateStatus(id: number, status: string) {
        if (!status) {
            throw new BadRequestException('Status is required');
        }

        const query = `
      UPDATE quotation_inquiry
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

        const result = await this.dataSource.query(query, [status, Number(id)]);

        if (result.length === 0) {
            throw new NotFoundException('Quotation inquiry not found');
        }

        return { inquiry: result[0] };
    }

    /**
     * Delete a quotation inquiry record
     */
    async deleteInquiry(id: number) {
        const query = `DELETE FROM quotation_inquiry WHERE id = $1 RETURNING *`;
        const result = await this.dataSource.query(query, [Number(id)]);

        if (result.length === 0) {
            throw new NotFoundException('Quotation inquiry not found');
        }

        return { message: 'Quotation inquiry deleted successfully' };
    }
}
