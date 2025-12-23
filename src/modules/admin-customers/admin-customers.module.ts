import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { Customer } from '../../entities/Customer';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer]),
    CommonModule,
  ],
  controllers: [AdminCustomersController],
  providers: [AdminCustomersService],
  exports: [AdminCustomersService],
})
export class AdminCustomersModule {}
