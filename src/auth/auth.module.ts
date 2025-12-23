import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/User';
import { Customer } from '../entities/Customer';
import { Company } from '../entities/Company';
import { CommonModule } from '../common/common.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { PermissionGuard } from './guards/permission.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Customer, Company]),
    CommonModule, // For EmailService
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'supersecret',
        signOptions: {
          expiresIn: '4h', // 4 hours
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    AdminGuard,
    SuperAdminGuard,
    PermissionGuard,
  ],
  exports: [AuthService, JwtAuthGuard, AdminGuard, SuperAdminGuard, PermissionGuard],
})
export class AuthModule {}

