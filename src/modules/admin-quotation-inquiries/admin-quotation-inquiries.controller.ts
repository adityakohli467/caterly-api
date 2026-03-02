import { Controller, Get, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AdminQuotationInquiriesService } from './admin-quotation-inquiries.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('admin/quotation-inquiries')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminQuotationInquiriesController {
    constructor(private readonly service: AdminQuotationInquiriesService) { }

    /**
     * List all inquiries with filtering
     * GET /admin/quotation-inquiries
     */
    @Get()
    async getInquiries(@Query() query: any) {
        return this.service.findAllInquiries(query);
    }

    /**
     * Get specific inquiry details
     * GET /admin/quotation-inquiries/:id
     */
    @Get(':id')
    async getInquiry(@Param('id') id: number) {
        return this.service.findOneInquiry(id);
    }

    /**
     * Update inquiry status
     * PATCH /admin/quotation-inquiries/:id/status
     */
    @Patch(':id/status')
    async updateStatus(@Param('id') id: number, @Body('status') status: string) {
        return this.service.updateStatus(id, status);
    }

    /**
     * Delete specific inquiry
     * DELETE /admin/quotation-inquiries/:id
     */
    @Delete(':id')
    async deleteInquiry(@Param('id') id: number) {
        return this.service.deleteInquiry(id);
    }
}
