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
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminOptionsService } from './admin-options.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Options')
@Controller('admin/options')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminOptionsController {
  constructor(private adminOptionsService: AdminOptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all options' })
  async findAll(@Query() query: any) {
    return this.adminOptionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get option by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminOptionsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new option' })
  async create(@Body() createOptionDto: any) {
    return this.adminOptionsService.create(createOptionDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update option' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateOptionDto: any) {
    return this.adminOptionsService.update(id, updateOptionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete option' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.adminOptionsService.delete(id);
    return { message: 'Option deleted successfully' };
  }
}
