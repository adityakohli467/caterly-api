import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StoreAuthController } from './store-auth.controller';
import { StoreAuthService } from './store-auth.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    CommonModule, // For EmailService
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
  controllers: [StoreAuthController],
  providers: [StoreAuthService],
  exports: [StoreAuthService],
})
export class StoreAuthModule {}

