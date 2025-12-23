import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminReviewsService {
  private readonly logger = new Logger(AdminReviewsService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * List product reviews with filters
   */
  async listProductReviews(filters: {
    limit?: number;
    offset?: number;
    status?: number;
    product_id?: number;
    search?: string;
  }) {
    const { limit = 20, offset = 0, status, product_id, search } = filters;

    let query = `
      SELECT 
        r.*,
        p.product_name,
        c.firstname as customer_firstname,
        c.lastname as customer_lastname,
        c.email as customer_email,
        u.username as reviewer_username
      FROM product_review r
      LEFT JOIN product p ON r.product_id = p.product_id
      LEFT JOIN customer c ON r.customer_id = c.customer_id
      LEFT JOIN "user" u ON r.reviewed_by = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      query += ` AND r.status = $${paramIndex++}`;
      params.push(status);
    }

    if (product_id) {
      query += ` AND r.product_id = $${paramIndex++}`;
      params.push(product_id);
    }

    if (search) {
      query += ` AND (
        r.review_text ILIKE $${paramIndex} OR 
        r.reviewer_name ILIKE $${paramIndex} OR 
        p.product_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ' ORDER BY r.created_at DESC';
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM product_review r LEFT JOIN product p ON r.product_id = p.product_id WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (status !== undefined) {
      countQuery += ` AND r.status = $${countParamIndex++}`;
      countParams.push(status);
    }

    if (product_id) {
      countQuery += ` AND r.product_id = $${countParamIndex++}`;
      countParams.push(product_id);
    }

    if (search) {
      countQuery += ` AND (
        r.review_text ILIKE $${countParamIndex} OR 
        r.reviewer_name ILIKE $${countParamIndex} OR 
        p.product_name ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const total = parseInt(countResult[0]?.count || '0', 10);

    return {
      reviews: result,
      total,
      limit,
      offset,
    };
  }

  /**
   * List general reviews with filters
   */
  async listGeneralReviews(filters: {
    limit?: number;
    offset?: number;
    status?: number;
    source?: string;
    search?: string;
  }) {
    const { limit = 20, offset = 0, status, source, search } = filters;

    let query = `
      SELECT 
        r.*,
        u.username as reviewer_username
      FROM general_review r
      LEFT JOIN "user" u ON r.reviewed_by = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      query += ` AND r.status = $${paramIndex++}`;
      params.push(status);
    }

    if (source) {
      query += ` AND r.source = $${paramIndex++}`;
      params.push(source);
    }

    if (search) {
      query += ` AND (
        r.review_text ILIKE $${paramIndex} OR 
        r.reviewer_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ' ORDER BY r.created_at DESC';
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM general_review r WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (status !== undefined) {
      countQuery += ` AND r.status = $${countParamIndex++}`;
      countParams.push(status);
    }

    if (source) {
      countQuery += ` AND r.source = $${countParamIndex++}`;
      countParams.push(source);
    }

    if (search) {
      countQuery += ` AND (
        r.review_text ILIKE $${countParamIndex} OR 
        r.reviewer_name ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const total = parseInt(countResult[0]?.count || '0', 10);

    return {
      reviews: result,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get single product review
   */
  async getProductReview(reviewId: number) {
    const query = `
      SELECT 
        r.*,
        p.product_name,
        c.firstname as customer_firstname,
        c.lastname as customer_lastname,
        c.email as customer_email,
        u.username as reviewer_username
      FROM product_review r
      LEFT JOIN product p ON r.product_id = p.product_id
      LEFT JOIN customer c ON r.customer_id = c.customer_id
      LEFT JOIN "user" u ON r.reviewed_by = u.user_id
      WHERE r.review_id = $1
    `;

    const result = await this.dataSource.query(query, [reviewId]);

    if (result.length === 0) {
      throw new NotFoundException(`Product review with ID ${reviewId} not found`);
    }

    return result[0];
  }

  /**
   * Get single general review
   */
  async getGeneralReview(reviewId: number) {
    const query = `
      SELECT 
        r.*,
        u.username as reviewer_username
      FROM general_review r
      LEFT JOIN "user" u ON r.reviewed_by = u.user_id
      WHERE r.review_id = $1
    `;

    const result = await this.dataSource.query(query, [reviewId]);

    if (result.length === 0) {
      throw new NotFoundException(`General review with ID ${reviewId} not found`);
    }

    return result[0];
  }

  /**
   * Approve/publish product review
   */
  async approveProductReview(reviewId: number, userId: number) {
    const review = await this.getProductReview(reviewId);

    if (review.status === 1) {
      throw new BadRequestException('Review is already approved');
    }

    const query = `
      UPDATE product_review
      SET status = 1,
          reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE review_id = $2
      RETURNING *
    `;

    const result = await this.dataSource.query(query, [userId, reviewId]);
    return result[0];
  }

  /**
   * Approve/publish general review
   */
  async approveGeneralReview(reviewId: number, userId: number) {
    const review = await this.getGeneralReview(reviewId);

    if (review.status === 1) {
      throw new BadRequestException('Review is already approved');
    }

    const query = `
      UPDATE general_review
      SET status = 1,
          reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE review_id = $2
      RETURNING *
    `;

    const result = await this.dataSource.query(query, [userId, reviewId]);
    return result[0];
  }

  /**
   * Reject product review
   */
  async rejectProductReview(reviewId: number, userId: number) {
    const review = await this.getProductReview(reviewId);

    if (review.status === 2) {
      throw new BadRequestException('Review is already rejected');
    }

    const query = `
      UPDATE product_review
      SET status = 2,
          reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE review_id = $2
      RETURNING *
    `;

    const result = await this.dataSource.query(query, [userId, reviewId]);
    return result[0];
  }

  /**
   * Reject general review
   */
  async rejectGeneralReview(reviewId: number, userId: number) {
    const review = await this.getGeneralReview(reviewId);

    if (review.status === 2) {
      throw new BadRequestException('Review is already rejected');
    }

    const query = `
      UPDATE general_review
      SET status = 2,
          reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE review_id = $2
      RETURNING *
    `;

    const result = await this.dataSource.query(query, [userId, reviewId]);
    return result[0];
  }

  /**
   * Delete product review
   */
  async deleteProductReview(reviewId: number) {
    const review = await this.getProductReview(reviewId);

    await this.dataSource.query('DELETE FROM product_review WHERE review_id = $1', [reviewId]);
    return { message: 'Product review deleted successfully' };
  }

  /**
   * Delete general review
   */
  async deleteGeneralReview(reviewId: number) {
    const review = await this.getGeneralReview(reviewId);

    await this.dataSource.query('DELETE FROM general_review WHERE review_id = $1', [reviewId]);
    return { message: 'General review deleted successfully' };
  }

  /**
   * Get review statistics
   */
  async getReviewStats() {
    const productStatsQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM product_review
      GROUP BY status
    `;

    const generalStatsQuery = `
      SELECT 
        status,
        COUNT(*) as count
      FROM general_review
      GROUP BY status
    `;

    const [productStats, generalStats] = await Promise.all([
      this.dataSource.query(productStatsQuery),
      this.dataSource.query(generalStatsQuery),
    ]);

    return {
      product_reviews: {
        pending: productStats.find((s: any) => s.status === 0)?.count || 0,
        approved: productStats.find((s: any) => s.status === 1)?.count || 0,
        rejected: productStats.find((s: any) => s.status === 2)?.count || 0,
        total: productStats.reduce((sum: number, s: any) => sum + parseInt(s.count), 0),
      },
      general_reviews: {
        pending: generalStats.find((s: any) => s.status === 0)?.count || 0,
        approved: generalStats.find((s: any) => s.status === 1)?.count || 0,
        rejected: generalStats.find((s: any) => s.status === 2)?.count || 0,
        total: generalStats.reduce((sum: number, s: any) => sum + parseInt(s.count), 0),
      },
    };
  }
}

