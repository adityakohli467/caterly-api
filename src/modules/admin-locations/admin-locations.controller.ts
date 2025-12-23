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
import { AdminLocationsService } from './admin-locations.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Locations')
@Controller('admin/locations')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminLocationsController {
  constructor(private adminLocationsService: AdminLocationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all locations' })
  async findAll(@Query() query: any) {
    return this.adminLocationsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get location by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminLocationsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new location' })
  async create(@Body() createLocationDto: any) {
    return this.adminLocationsService.create(createLocationDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update location' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateLocationDto: any) {
    return this.adminLocationsService.update(id, updateLocationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete location' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.adminLocationsService.delete(id);
    return { message: 'Location deleted successfully' };
  }
}
