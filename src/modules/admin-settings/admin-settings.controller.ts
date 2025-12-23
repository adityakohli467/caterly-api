import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminSettingsService } from './admin-settings.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Settings')
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminSettingsController {
  constructor(private adminSettingsService: AdminSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  async findAll(@Query('category') category?: string) {
    return this.adminSettingsService.findAll(category);
  }

  @Put()
  @ApiOperation({ summary: 'Update settings' })
  async update(@Body() settings: any) {
    return this.adminSettingsService.update(settings);
  }

  @Get('system/health')
  @ApiOperation({ summary: 'Get system health' })
  async getSystemHealth() {
    return this.adminSettingsService.getSystemHealth();
  }
}
