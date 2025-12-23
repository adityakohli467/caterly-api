import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AdminHistoryService } from './admin-history.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Admin History')
@Controller('admin/history')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminHistoryController {
  constructor(private readonly historyService: AdminHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get API history with filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'eventType', required: false, type: String })
  @ApiQuery({ name: 'eventCategory', required: false, type: String })
  @ApiQuery({ name: 'resourceType', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  @ApiQuery({ name: 'customerId', required: false, type: Number })
  @ApiQuery({ name: 'userType', required: false, type: String })
  @ApiQuery({ name: 'requestMethod', required: false, type: String })
  @ApiQuery({ name: 'requestPath', required: false, type: String })
  @ApiQuery({ name: 'isSuccessful', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getHistory(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('eventType') eventType?: string,
    @Query('eventCategory') eventCategory?: string,
    @Query('resourceType') resourceType?: string,
    @Query('userId') userId?: number,
    @Query('customerId') customerId?: number,
    @Query('userType') userType?: string,
    @Query('requestMethod') requestMethod?: string,
    @Query('requestPath') requestPath?: string,
    @Query('isSuccessful') isSuccessful?: boolean,
    @Query('search') search?: string,
  ) {
    return this.historyService.getHistory({
      page,
      limit,
      startDate,
      endDate,
      eventType,
      eventCategory,
      resourceType,
      userId,
      customerId,
      userType,
      requestMethod,
      requestPath,
      isSuccessful,
      search,
    });
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get history statistics' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'userType', required: false, type: String })
  async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userType') userType?: string,
  ) {
    return this.historyService.getStatistics({
      startDate,
      endDate,
      userType,
    });
  }

  @Get('event-types')
  @ApiOperation({ summary: 'Get all event types' })
  async getEventTypes() {
    return this.historyService.getEventTypes();
  }

  @Get('event-categories')
  @ApiOperation({ summary: 'Get all event categories' })
  async getEventCategories() {
    return this.historyService.getEventCategories();
  }

  @Get('resource-types')
  @ApiOperation({ summary: 'Get all resource types' })
  async getResourceTypes() {
    return this.historyService.getResourceTypes();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get history entry by ID' })
  async getHistoryById(@Param('id', ParseIntPipe) id: number) {
    return this.historyService.getHistoryById(id);
  }
}

