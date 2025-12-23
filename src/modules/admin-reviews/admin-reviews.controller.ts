import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Request,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminReviewsService } from './admin-reviews.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Reviews')
@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminReviewsController {
  constructor(private readonly adminReviewsService: AdminReviewsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get review statistics' })
  async getStats() {
    return this.adminReviewsService.getReviewStats();
  }

  @Get('products')
  @ApiOperation({ summary: 'List product reviews' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: Number, description: '0=pending, 1=approved, 2=rejected' })
  @ApiQuery({ name: 'product_id', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async listProductReviews(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('product_id') product_id?: string,
    @Query('search') search?: string,
  ) {
    return this.adminReviewsService.listProductReviews({
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
      status: status ? parseInt(status) : undefined,
      product_id: product_id ? parseInt(product_id) : undefined,
      search,
    });
  }

  @Get('general')
  @ApiOperation({ summary: 'List general reviews' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: Number, description: '0=pending, 1=approved, 2=rejected' })
  @ApiQuery({ name: 'source', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async listGeneralReviews(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('search') search?: string,
  ) {
    return this.adminReviewsService.listGeneralReviews({
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
      status: status ? parseInt(status) : undefined,
      source,
      search,
    });
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get single product review' })
  @ApiParam({ name: 'id', type: Number })
  async getProductReview(@Param('id', ParseIntPipe) id: number) {
    return this.adminReviewsService.getProductReview(id);
  }

  @Get('general/:id')
  @ApiOperation({ summary: 'Get single general review' })
  @ApiParam({ name: 'id', type: Number })
  async getGeneralReview(@Param('id', ParseIntPipe) id: number) {
    return this.adminReviewsService.getGeneralReview(id);
  }

  @Put('products/:id/approve')
  @ApiOperation({ summary: 'Approve/publish product review' })
  @ApiParam({ name: 'id', type: Number })
  async approveProductReview(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.adminReviewsService.approveProductReview(id, req.user.user_id);
  }

  @Put('general/:id/approve')
  @ApiOperation({ summary: 'Approve/publish general review' })
  @ApiParam({ name: 'id', type: Number })
  async approveGeneralReview(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.adminReviewsService.approveGeneralReview(id, req.user.user_id);
  }

  @Put('products/:id/reject')
  @ApiOperation({ summary: 'Reject product review' })
  @ApiParam({ name: 'id', type: Number })
  async rejectProductReview(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.adminReviewsService.rejectProductReview(id, req.user.user_id);
  }

  @Put('general/:id/reject')
  @ApiOperation({ summary: 'Reject general review' })
  @ApiParam({ name: 'id', type: Number })
  async rejectGeneralReview(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.adminReviewsService.rejectGeneralReview(id, req.user.user_id);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete product review' })
  @ApiParam({ name: 'id', type: Number })
  async deleteProductReview(@Param('id', ParseIntPipe) id: number) {
    return this.adminReviewsService.deleteProductReview(id);
  }

  @Delete('general/:id')
  @ApiOperation({ summary: 'Delete general review' })
  @ApiParam({ name: 'id', type: Number })
  async deleteGeneralReview(@Param('id', ParseIntPipe) id: number) {
    return this.adminReviewsService.deleteGeneralReview(id);
  }
}

