import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { AdminFeedbackService } from './admin-feedback.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Feedback')
@Controller('admin/feedbacks')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminFeedbackController {
  constructor(private readonly adminFeedbackService: AdminFeedbackService) {}

  @Get()
  @ApiOperation({ summary: 'List customer feedbacks' })
  @ApiQuery({ name: 'improvement_on', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async listFeedbacks(
    @Query('improvement_on') improvementOn?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminFeedbackService.listFeedbacks({
      improvement_on: improvementOn,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single feedback' })
  @ApiParam({ name: 'id', type: Number })
  async getFeedback(@Param('id', ParseIntPipe) id: number) {
    return this.adminFeedbackService.getFeedback(id);
  }

  @Post(':id/send-email')
  @ApiOperation({ summary: 'Send feedback email to customer' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        recipient_email: { type: 'string', format: 'email' },
        custom_message: { type: 'string' },
      },
    },
  })
  async sendFeedbackEmail(
    @Param('id', ParseIntPipe) id: number,
    @Body('recipient_email') recipientEmail?: string,
    @Body('custom_message') customMessage?: string,
  ) {
    return this.adminFeedbackService.sendFeedbackEmail(id, recipientEmail, customMessage);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete feedback' })
  @ApiParam({ name: 'id', type: Number })
  async deleteFeedback(@Param('id', ParseIntPipe) id: number) {
    return this.adminFeedbackService.deleteFeedback(id);
  }
}
