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
import { AdminCouponsService } from './admin-coupons.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Coupons')
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private adminCouponsService: AdminCouponsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all coupons' })
  async findAll(@Query() query: any) {
    return this.adminCouponsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get coupon by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminCouponsService.findOne(id);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate coupon code (public)' })
  async validateCoupon(@Body() body: { code: string }) {
    return this.adminCouponsService.validateCoupon(body.code);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new coupon' })
  async create(@Body() createCouponDto: any) {
    return this.adminCouponsService.create(createCouponDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update coupon' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateCouponDto: any) {
    return this.adminCouponsService.update(id, updateCouponDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete coupon' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.adminCouponsService.delete(id);
    return { message: 'Coupon deleted successfully' };
  }
}
