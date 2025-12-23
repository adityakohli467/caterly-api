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
import { AdminWholesaleEnquiriesService } from './admin-wholesale-enquiries.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Wholesale Enquiries')
@Controller('admin/wholesale-enquiries')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminWholesaleEnquiriesController {
  constructor(private readonly adminWholesaleEnquiriesService: AdminWholesaleEnquiriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all wholesale enquiries' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async listWholesaleEnquiries(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminWholesaleEnquiriesService.listWholesaleEnquiries({
      status,
      search,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single wholesale enquiry' })
  @ApiParam({ name: 'id', type: Number })
  async getWholesaleEnquiry(@Param('id', ParseIntPipe) id: number) {
    return this.adminWholesaleEnquiriesService.getWholesaleEnquiry(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update wholesale enquiry status' })
  @ApiParam({ name: 'id', type: Number })
  async updateWholesaleEnquiry(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
  ) {
    return this.adminWholesaleEnquiriesService.updateWholesaleEnquiry(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete wholesale enquiry' })
  @ApiParam({ name: 'id', type: Number })
  async deleteWholesaleEnquiry(@Param('id', ParseIntPipe) id: number) {
    return this.adminWholesaleEnquiriesService.deleteWholesaleEnquiry(id);
  }
}
