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
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminRolesService } from './admin-roles.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Roles')
@Controller('admin/roles')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminRolesController {
  constructor(private adminRolesService: AdminRolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all roles' })
  async findAll(@Query() query: any) {
    return this.adminRolesService.findAll(query);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Get all available permissions' })
  async getAllPermissions() {
    return this.adminRolesService.getAllPermissions();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by ID with permissions' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminRolesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new role' })
  async create(@Body() createRoleDto: any, @Request() req: any) {
    const currentUserLevel = req.user?.auth_level;
    return this.adminRolesService.create(createRoleDto, currentUserLevel);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update role' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: any,
    @Request() req: any,
  ) {
    const currentUserLevel = req.user?.auth_level;
    return this.adminRolesService.update(id, updateRoleDto, currentUserLevel);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete role' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.adminRolesService.delete(id);
    return { message: 'Role deleted successfully' };
  }

  @Get('user/:userId/permissions')
  @ApiOperation({ summary: 'Get user permissions' })
  async getUserPermissions(@Param('userId', ParseIntPipe) userId: number) {
    const permissions = await this.adminRolesService.getUserPermissions(userId);
    return { permissions };
  }
}

