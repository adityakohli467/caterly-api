import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminContactInquiriesService } from './admin-contact-inquiries.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Contact Inquiries')
@Controller('admin/contact-inquiries')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminContactInquiriesController {
  constructor(private readonly adminContactInquiriesService: AdminContactInquiriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all contact inquiries' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async listContactInquiries(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminContactInquiriesService.listContactInquiries({
      status,
      search,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single contact inquiry' })
  @ApiParam({ name: 'id', type: Number })
  async getContactInquiry(@Param('id', ParseIntPipe) id: number) {
    return this.adminContactInquiriesService.getContactInquiry(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update contact inquiry status' })
  @ApiParam({ name: 'id', type: Number })
  async updateContactInquiry(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
  ) {
    return this.adminContactInquiriesService.updateContactInquiry(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete contact inquiry' })
  @ApiParam({ name: 'id', type: Number })
  async deleteContactInquiry(@Param('id', ParseIntPipe) id: number) {
    return this.adminContactInquiriesService.deleteContactInquiry(id);
  }
}
