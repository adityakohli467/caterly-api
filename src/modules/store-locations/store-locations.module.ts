import { Module } from '@nestjs/common';
import { StoreLocationsController } from './store-locations.controller';
import { StoreLocationsService } from './store-locations.service';

@Module({
  imports: [],
  controllers: [StoreLocationsController],
  providers: [StoreLocationsService],
  exports: [StoreLocationsService],
})
export class StoreLocationsModule {}
