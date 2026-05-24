import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
// Import entities that ApiHistory depends on to ensure proper metadata resolution
import { ApiHistory } from '../entities/ApiHistory.entity';
import { User } from '../entities/User';
import { Customer } from '../entities/Customer';
import { Role } from '../entities/Role';
import { UserRole } from '../entities/UserRole';
import { Permission } from '../entities/Permission';
import { Company } from '../entities/Company';
import { Department } from '../entities/Department';
import { Order } from '../entities/Order';
import { Location } from '../entities/Location';
import { OrderProduct } from '../entities/OrderProduct';
import { OrderProductOption } from '../entities/OrderProductOption';
import { Product } from '../entities/Product';
import { Category } from '../entities/Category';
import { ProductImage } from '../entities/ProductImage';
import { PaymentHistory } from '../entities/PaymentHistory';

/**
 * Get database configuration with automatic SSL detection for AWS RDS
 * This centralizes all database configuration logic
 */
export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  // Single database configuration - uses DATABASE_URL environment variable
  const dbUrl = 
    configService.get<string>('DATABASE_URL') || 
    'postgresql://postgres:postgres@localhost:5432/caterly_db';

  // SSL Detection Logic:
  // - Can be explicitly disabled with DB_SSL=false
  // - Enable SSL for ANY non-localhost connection (AWS, RDS, remote servers)
  // - Disable SSL only for localhost in development
  // - Can be forced with DB_SSL=true environment variable
  const isLocalhost = 
    dbUrl.includes('localhost') || 
    dbUrl.includes('127.0.0.1') || 
    dbUrl.includes('::1');

  const dbSslEnv = configService.get<string>('DB_SSL');
  const useSSL = 
    dbSslEnv === 'false' ? false :  // Explicitly disabled
    dbSslEnv === 'true' ? true :  // Explicitly enabled
    (!isLocalhost ||  // Not localhost = enable SSL (AWS, RDS, etc.)
    dbUrl.includes('rds.amazonaws.com') ||  // AWS RDS
    dbUrl.includes('.rds.') ||  // Any RDS endpoint pattern
    configService.get<string>('NODE_ENV') === 'production' ||  // Production = use SSL
    dbUrl.includes('?ssl=true') ||  // URL parameter
    dbUrl.includes('?sslmode=require'));  // URL parameter

  return {
    type: 'postgres',
    url: dbUrl,
    entities: [
      __dirname + '/../**/*.entity{.ts,.js}',
      // Explicitly include entities with relations to ensure proper metadata resolution
      // This ensures TypeORM can build metadata for all relations in the correct order
      ApiHistory,
      User,
      Customer,
      Role,
      UserRole,
      Permission,
      Company,
      Department,
      Order,
      Location,
      OrderProduct,
      OrderProductOption,
      Product,
      Category,
      ProductImage,
      PaymentHistory,
    ],
    synchronize: false, // Never use synchronize in production - use migrations
    logging: configService.get<string>('NODE_ENV') === 'development',
    extra: {
      max: 20, // Maximum pool size
      connectionTimeoutMillis: 2000,
      // Set session timezone to AEST so CURRENT_TIMESTAMP returns Australian time
      options: '-c timezone=Australia/Sydney',
      ssl: useSSL ? {
        rejectUnauthorized: false, // Accept self-signed certificates for AWS RDS
      } : false,
    },
  };
};

