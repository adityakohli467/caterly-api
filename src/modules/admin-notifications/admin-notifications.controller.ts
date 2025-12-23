import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminNotificationsService } from './admin-notifications.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Admin Notifications')
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminNotificationsController {
  constructor(private readonly adminNotificationsService: AdminNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'read_status', required: false, type: String })
  async getNotifications(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('read_status') readStatus?: string,
  ) {
    const userId = req.user?.user_id;
    return this.adminNotificationsService.getNotifications(userId, {
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
      read_status: readStatus,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@Request() req: any) {
    const userId = req.user?.user_id;
    return this.adminNotificationsService.getUnreadCount(userId);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', type: Number })
  async markAsRead(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const userId = req.user?.user_id;
    return this.adminNotificationsService.markAsRead(id, userId);
  }

  @Put('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Request() req: any) {
    const userId = req.user?.user_id;
    return this.adminNotificationsService.markAllAsRead(userId);
  }
}
