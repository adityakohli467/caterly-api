import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

@ApiTags('Store Reviews')
@Controller('store/reviews')
export class StoreReviewsController {
  constructor(private dataSource: DataSource) {}

  @Post('general')
  @ApiOperation({ summary: 'Submit a general/homepage review' })
  async submitGeneralReview(
    @Body() reviewData: {
      rating: number;
      review_text: string;
      reviewer_name: string;
      reviewer_email?: string;
      reviewer_location?: string;
      source?: string;
    },
  ) {
    const { rating, review_text, reviewer_name, reviewer_email, reviewer_location, source } = reviewData;

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    if (!review_text || review_text.trim().length === 0) {
      throw new BadRequestException('Review text is required');
    }

    if (review_text.trim().length < 10) {
      throw new BadRequestException('Review text must be at least 10 characters');
    }

    if (!reviewer_name || reviewer_name.trim().length === 0) {
      throw new BadRequestException('Reviewer name is required');
    }

    // Insert review with pending status
    const insertQuery = `
      INSERT INTO general_review (
        rating,
        review_text,
        reviewer_name,
        reviewer_email,
        reviewer_location,
        source,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING review_id, created_at
    `;

    const result = await this.dataSource.query(insertQuery, [
      rating,
      review_text.trim(),
      reviewer_name.trim(),
      reviewer_email?.trim() || null,
      reviewer_location?.trim() || null,
      source || 'homepage',
      0, // Pending approval
    ]);

    return {
      message: 'Review submitted successfully. It will be reviewed before being published.',
      review: {
        review_id: result[0].review_id,
        rating,
        review_text: review_text.trim(),
        reviewer_name: reviewer_name.trim(),
        created_at: result[0].created_at,
      },
    };
  }

  @Get('general')
  @ApiOperation({ summary: 'Get published general reviews for homepage' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPublishedGeneralReviews(@Query('limit') limit?: string) {
    const query = `
      SELECT 
        review_id,
        rating,
        review_text,
        reviewer_name,
        reviewer_location,
        created_at
      FROM general_review
      WHERE status = 1
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const result = await this.dataSource.query(query, [limit ? parseInt(limit) : 10]);

    return {
      reviews: result,
      count: result.length,
    };
  }
}

