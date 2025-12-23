import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminRolesService } from './admin-roles.service';
import { AdminRolesController } from './admin-roles.controller';
import { Role } from '../../entities/Role';
import { Permission } from '../../entities/Permission';
import { UserRole } from '../../entities/UserRole';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, UserRole])],
  controllers: [AdminRolesController],
  providers: [AdminRolesService],
  exports: [AdminRolesService],
})
export class AdminRolesModule {}

