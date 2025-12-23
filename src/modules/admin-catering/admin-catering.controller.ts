import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminCateringService } from './admin-catering.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Catering')
@Controller('admin/catering')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminCateringController {
  constructor(private readonly adminCateringService: AdminCateringService) {}

  @Get('checklist/:order_id')
  @ApiOperation({ summary: 'Get catering checklist' })
  @ApiParam({ name: 'order_id', type: Number })
  async getCateringChecklist(@Param('order_id', ParseIntPipe) orderId: number) {
    return this.adminCateringService.getCateringChecklist(orderId);
  }

  @Post('checklist/:order_id')
  @ApiOperation({ summary: 'Create/Update catering checklist' })
  @ApiParam({ name: 'order_id', type: Number })
  async saveCateringChecklist(
    @Param('order_id', ParseIntPipe) orderId: number,
    @Body() checklistData: any,
  ) {
    return this.adminCateringService.saveCateringChecklist(orderId, checklistData);
  }

  @Get('feedback')
  @ApiOperation({ summary: 'List feedback' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'location_id', required: false, type: Number })
  async listFeedback(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('location_id') locationId?: string,
  ) {
    return this.adminCateringService.listFeedback({
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
      location_id: locationId ? parseInt(locationId) : undefined,
    });
  }

  @Get('feedback/:id')
  @ApiOperation({ summary: 'Get feedback' })
  @ApiParam({ name: 'id', type: Number })
  async getFeedback(@Param('id', ParseIntPipe) id: number) {
    return this.adminCateringService.getFeedback(id);
  }

  @Get('surveys')
  @ApiOperation({ summary: 'List surveys' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'location_id', required: false, type: Number })
  async listSurveys(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('location_id') locationId?: string,
  ) {
    return this.adminCateringService.listSurveys({
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
      location_id: locationId ? parseInt(locationId) : undefined,
    });
  }
}
