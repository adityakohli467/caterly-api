import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AdminEmailConfigService } from './admin-email-config.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Email Configuration')
@Controller('admin/email-config')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminEmailConfigController {
  constructor(private readonly adminEmailConfigService: AdminEmailConfigService) {}

  @Get('configurations')
  @ApiOperation({ summary: 'Get all email configurations' })
  async getConfigurations() {
    return this.adminEmailConfigService.getConfigurations();
  }

  @Put('configurations/:key')
  @ApiOperation({ summary: 'Update email configuration' })
  @ApiParam({ name: 'key', type: String })
  async updateConfiguration(
    @Param('key') key: string,
    @Body() body: { config_value: string; description?: string },
  ) {
    return this.adminEmailConfigService.updateConfiguration(key, body.config_value, body.description);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all email templates' })
  async getTemplates() {
    return this.adminEmailConfigService.getTemplates();
  }

  @Get('templates/:key')
  @ApiOperation({ summary: 'Get single email template' })
  @ApiParam({ name: 'key', type: String })
  async getTemplate(@Param('key') key: string) {
    return this.adminEmailConfigService.getTemplate(key);
  }

  @Put('templates/:key')
  @ApiOperation({ summary: 'Update email template' })
  @ApiParam({ name: 'key', type: String })
  async updateTemplate(
    @Param('key') key: string,
    @Body() body: {
      template_name?: string;
      subject?: string;
      body_html?: string;
      body_text?: string;
      variables?: any;
      is_active?: boolean;
    },
  ) {
    return this.adminEmailConfigService.updateTemplate(key, body);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get email logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'templateKey', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'recipientEmail', required: false, type: String })
  async getEmailLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('templateKey') templateKey?: string,
    @Query('status') status?: string,
    @Query('recipientEmail') recipientEmail?: string,
  ) {
    return this.adminEmailConfigService.getEmailLogs(
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
      { templateKey, status, recipientEmail },
    );
  }

  @Post('test')
  @ApiOperation({ summary: 'Test email configuration' })
  async testEmailConfiguration(@Body() body: { recipient_email: string }) {
    return this.adminEmailConfigService.testEmailConfiguration(body.recipient_email);
  }
}

