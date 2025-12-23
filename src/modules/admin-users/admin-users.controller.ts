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
import { AdminUsersService } from './admin-users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users' })
  async findAll(@Query() query: any, @Request() req: any) {
    const currentUserLevel = req.user?.auth_level;
    return this.adminUsersService.findAll(query, currentUserLevel);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const currentUserLevel = req.user?.auth_level;
    return this.adminUsersService.findOne(id, currentUserLevel);
  }

  @Post()
  @ApiOperation({ summary: 'Create new user' })
  async create(@Body() createUserDto: any, @Request() req: any) {
    const currentUserLevel = req.user?.auth_level;
    return this.adminUsersService.create(createUserDto, currentUserLevel);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: any, @Request() req: any) {
    const currentUserLevel = req.user?.auth_level;
    return this.adminUsersService.update(id, updateUserDto, currentUserLevel);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  async delete(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const currentUserId = req.user?.user_id;
    const currentUserLevel = req.user?.auth_level;
    await this.adminUsersService.delete(id, currentUserId, currentUserLevel);
    return { message: 'User deleted successfully' };
  }
}
