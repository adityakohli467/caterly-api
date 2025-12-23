import { Module } from '@nestjs/common';
import { AdminLocationsController } from './admin-locations.controller';
import { AdminLocationsService } from './admin-locations.service';

@Module({
  imports: [],
  controllers: [AdminLocationsController],
  providers: [AdminLocationsService],
  exports: [AdminLocationsService],
})
export class AdminLocationsModule {}
