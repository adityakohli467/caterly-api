import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { StoreLocationsService } from './store-locations.service';

@ApiTags('Store Locations')
@Controller('store/locations')
export class StoreLocationsController {
  constructor(private readonly storeLocationsService: StoreLocationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get available locations and check postcode' })
  @ApiQuery({ name: 'postcode', required: false, type: String })
  async getLocations(@Query('postcode') postcode?: string) {
    return this.storeLocationsService.getLocations(postcode);
  }

  @Get('check/:postcode')
  @ApiOperation({ summary: 'Check if postcode is serviceable' })
  @ApiParam({ name: 'postcode', type: String })
  async checkPostcode(@Param('postcode') postcode: string) {
    return this.storeLocationsService.checkPostcode(postcode);
  }
}
