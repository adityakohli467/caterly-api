import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { StoreProductsService } from './store-products.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Store Products')
@Controller('store/products')
export class StoreProductsController {
  constructor(private readonly storeProductsService: StoreProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products for storefront with filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category_id', required: false, type: Number })
  @ApiQuery({ name: 'heading_id', required: false, type: Number })
  @ApiQuery({ name: 'min_price', required: false, type: Number })
  @ApiQuery({ name: 'max_price', required: false, type: Number })
  @ApiQuery({ name: 'order_by', required: false, enum: ['featured', 'price-low', 'price-high', 'newest'] })
  async listProducts(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category_id') categoryId?: string,
    @Query('heading_id') headingId?: string,
    @Query('min_price') minPrice?: string,
    @Query('max_price') maxPrice?: string,
    @Query('order_by') orderBy?: string,
  ) {
    return this.storeProductsService.listProducts(
      {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        search,
        category_id: categoryId ? parseInt(categoryId) : undefined,
        heading_id: headingId ? parseInt(headingId) : undefined,
        min_price: minPrice ? parseFloat(minPrice) : undefined,
        max_price: maxPrice ? parseFloat(maxPrice) : undefined,
        order_by: orderBy,
      },
      req.headers.authorization,
    );
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured/popular products' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getFeaturedProducts(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    return this.storeProductsService.getFeaturedProducts(
      limit ? parseInt(limit) : 8,
      req.headers.authorization,
    );
  }

  @Get('featured/coffee')
  @ApiOperation({ summary: 'Get featured coffee products (featured_1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getFeaturedCoffeeProducts(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    return this.storeProductsService.getFeaturedProductsByFlag(
      'featured_1',
      limit ? parseInt(limit) : 4,
      req.headers.authorization,
    );
  }

  @Get('featured/tea')
  @ApiOperation({ summary: 'Get featured tea products (featured_2)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getFeaturedTeaProducts(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    return this.storeProductsService.getFeaturedProductsByFlag(
      'featured_2',
      limit ? parseInt(limit) : 4,
      req.headers.authorization,
    );
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all categories for storefront' })
  async getCategories() {
    return this.storeProductsService.getCategories();
  }

  @Get('headers')
  @ApiOperation({ summary: 'Get product headers (sections)' })
  async getHeaders() {
    return this.storeProductsService.getHeaders();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product details with options' })
  @ApiParam({ name: 'id', type: Number })
  async getProduct(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.storeProductsService.getProduct(id, req.headers.authorization);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Get reviews for a product' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getProductReviews(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.storeProductsService.getProductReviews(
      id,
      limit ? parseInt(limit) : 10,
      offset ? parseInt(offset) : 0,
    );
  }

  @Post(':id/reviews')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a product review' })
  @ApiParam({ name: 'id', type: Number })
  async submitProductReview(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() reviewData: {
      rating: number;
      review_text: string;
      reviewer_name?: string;
      reviewer_email?: string;
    },
  ) {
    return this.storeProductsService.submitProductReview(
      id,
      reviewData,
      req.headers.authorization,
    );
  }
}
