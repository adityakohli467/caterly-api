import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminBlogsService } from '../admin-blogs/admin-blogs.service';

@ApiTags('Store Blogs')
@Controller('store/blogs')
export class StoreBlogsController {
  constructor(private readonly blogsService: AdminBlogsService) {}

  @Get()
  @ApiOperation({ summary: 'Get published blogs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getPublishedBlogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('category') category?: string,
    @Query('featured') featured?: string,
    @Query('search') search?: string,
  ) {
    return this.blogsService.getPublishedBlogs({
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
      category,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      search,
    });
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get blog categories' })
  async getCategories() {
    return this.blogsService.getCategories();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get blog by slug' })
  @ApiParam({ name: 'slug', type: String })
  async getBlogBySlug(@Param('slug') slug: string) {
    return this.blogsService.getBlogBySlug(slug);
  }
}

