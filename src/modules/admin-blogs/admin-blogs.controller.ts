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
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminBlogsService } from './admin-blogs.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Blogs')
@Controller('admin/blogs')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminBlogsController {
  constructor(private readonly adminBlogsService: AdminBlogsService) {}

  @Get()
  @ApiOperation({ summary: 'List blogs with search and pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'is_published', required: false, type: Boolean })
  @ApiQuery({ name: 'category', required: false, type: String })
  async listBlogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
    @Query('is_published') is_published?: string,
    @Query('category') category?: string,
  ) {
    return this.adminBlogsService.listBlogs({
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
      search,
      is_published: is_published === 'true' ? true : is_published === 'false' ? false : undefined,
      category,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single blog' })
  @ApiParam({ name: 'id', type: Number })
  async getBlog(@Param('id', ParseIntPipe) id: number) {
    return this.adminBlogsService.getBlog(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new blog' })
  async createBlog(@Body() data: any, @Request() req: any) {
    return this.adminBlogsService.createBlog({
      ...data,
      created_by: req.user.user_id,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update blog' })
  @ApiParam({ name: 'id', type: Number })
  async updateBlog(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
    return this.adminBlogsService.updateBlog(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete blog' })
  @ApiParam({ name: 'id', type: Number })
  async deleteBlog(@Param('id', ParseIntPipe) id: number) {
    return this.adminBlogsService.deleteBlog(id);
  }

  @Post('upload-image')
  @ApiOperation({ summary: 'Upload featured image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    return {
      image_url: await this.adminBlogsService.uploadFeaturedImage(file),
    };
  }
}

