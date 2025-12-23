import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminCompaniesController } from './admin-companies.controller';
import { AdminCompaniesService } from './admin-companies.service';
import { Department } from '../../entities/Department';

@Module({
  imports: [TypeOrmModule.forFeature([Department])],
  controllers: [AdminCompaniesController],
  providers: [AdminCompaniesService],
  exports: [AdminCompaniesService],
})
export class AdminCompaniesModule {}
