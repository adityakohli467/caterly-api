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
import { AdminQuotesService } from './admin-quotes.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@ApiTags('Admin Quotes')
@Controller('admin/quotes')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminQuotesController {
  constructor(private adminQuotesService: AdminQuotesService) {}

  @Get()
  @ApiOperation({ summary: 'List all quotes' })
  async findAll(@Query() query: any) {
    return this.adminQuotesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quote by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminQuotesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new quote' })
  async create(@Body() createQuoteDto: any, @Request() req: any) {
    const userId = req.user?.user_id;
    return this.adminQuotesService.create(createQuoteDto, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update quote' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateQuoteDto: any, @Request() req: any) {
    const userId = req.user?.user_id;
    return this.adminQuotesService.update(id, updateQuoteDto, userId);
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Convert quote to order' })
  async convertToOrder(@Param('id', ParseIntPipe) id: number) {
    return this.adminQuotesService.convertToOrder(id);
  }

  @Post(':id/send-email')
  @ApiOperation({ summary: 'Send quote email to customer' })
  async sendEmail(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { recipient_email?: string; custom_message?: string },
  ) {
    return this.adminQuotesService.sendEmail(id, body.recipient_email, body.custom_message);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete quote' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.adminQuotesService.delete(id);
    return { message: 'Quote deleted successfully' };
  }
}
