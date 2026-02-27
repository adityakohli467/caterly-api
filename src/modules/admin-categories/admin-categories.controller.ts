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
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminCategoriesService } from './admin-categories.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Categories')
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminCategoriesController {
  constructor(private adminCategoriesService: AdminCategoriesService) { }

  @Get()
  @ApiOperation({ summary: 'List all categories' })
  async findAll(@Query() query: any) {
    return this.adminCategoriesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminCategoriesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new category' })
  async create(@Body() createCategoryDto: any) {
    return this.adminCategoriesService.create(createCategoryDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update category' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateCategoryDto: any) {
    return this.adminCategoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete category' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.adminCategoriesService.delete(id);
    return { message: 'Category deleted successfully' };
  }

  @Post('reorder')
  @ApiOperation({ summary: 'Reorder categories' })
  async reorder(@Body() reorderDto: { category_id: number; sort_order: number }[]) {
    await this.adminCategoriesService.reorder(reorderDto);
    return { message: 'Categories reordered successfully' };
  }
}
