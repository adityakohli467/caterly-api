import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { StoreSubscriptionsService } from './store-subscriptions.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Store Subscriptions')
@Controller('store/subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoreSubscriptionsController {
  constructor(private readonly storeSubscriptionsService: StoreSubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: "List user's subscriptions (standing orders)" })
  async listSubscriptions(@Request() req: any) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeSubscriptionsService.listSubscriptions(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single subscription' })
  @ApiParam({ name: 'id', type: Number })
  async getSubscription(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeSubscriptionsService.getSubscription(userId, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiParam({ name: 'id', type: Number })
  async cancelSubscription(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user?.user_id;
    if (!userId) {
      throw new Error('Unauthorized');
    }
    return this.storeSubscriptionsService.cancelSubscription(userId, id);
  }
}
