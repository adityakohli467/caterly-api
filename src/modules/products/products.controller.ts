import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Products')
@Controller('admin/products')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List all products' })
  async findAll(@Query() query: any) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create new product' })
  async create(
    @Body() productData: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: any,
  ) {
    const userId = req.user?.user_id;
    return this.productsService.create(productData, files, userId);
  }

  @Put(':id')
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update product' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() productData: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.update(id, productData, files);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete product' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.productsService.delete(id);
    return { message: 'Product deleted successfully' };
  }

  // Category endpoints
  @Get('categories/list')
  @ApiOperation({ summary: 'List all categories' })
  async listCategories() {
    return this.productsService.listCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create category' })
  async createCategory(@Body() categoryData: { category_name: string; parent_category_id?: number }) {
    return this.productsService.createCategory(categoryData);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Update category' })
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() categoryData: { category_name?: string; parent_category_id?: number },
  ) {
    return this.productsService.updateCategory(id, categoryData);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete category' })
  async deleteCategory(@Param('id', ParseIntPipe) id: number) {
    await this.productsService.deleteCategory(id);
    return { message: 'Category deleted successfully' };
  }
}
