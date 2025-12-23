# STX API

NestJS-based API for STX application. Migrated from Express/Node.js backend.

## Features

- ✅ **NestJS Framework** - Modern, scalable Node.js framework
- ✅ **TypeORM** - Type-safe ORM with connection pooling
- ✅ **PostgreSQL** - Database with SSL support for AWS RDS
- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **Swagger Documentation** - Auto-generated API documentation
- ✅ **AWS Secrets Manager** - Secure configuration management
- ✅ **CORS Enabled** - Cross-origin resource sharing configured

## Project Structure

```
stx_api/
├── src/
│   ├── config/              # Configuration modules
│   │   ├── config.module.ts
│   │   ├── database.config.ts
│   │   └── secrets.config.ts
│   ├── database/            # Database module
│   │   └── database.module.ts
│   ├── auth/                # Authentication module
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── guards/          # JWT, Admin, SuperAdmin guards
│   │   └── strategies/      # JWT strategy
│   ├── entities/            # TypeORM entities
│   ├── modules/             # Feature modules
│   │   └── products/        # Example: Products module
│   ├── common/              # Shared utilities
│   └── main.ts              # Application entry point
├── MIGRATION_GUIDE.md       # Migration guide from Express
└── README.md                # This file
```

## Installation

```bash
npm install
```

## Configuration

Copy environment variables from `backend-medusa`:

```bash
cp ../backend-medusa/.env .env
```

Required environment variables:
- `DATABASE_URL` or `ADMIN_DB_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `PORT` - Server port (default: 9000)
- `NODE_ENV` - Environment (development/production)

Optional (for AWS):
- `SECRET_NAME` or `AWS_SECRET_NAME` - AWS Secrets Manager secret name
- `AWS_REGION` - AWS region (default: us-east-1)

## Running the Application

```bash
# Development mode (with hot reload)
npm run start:dev

# Production build
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:9000/api-docs
- **Health Check**: http://localhost:9000/health

## Database Connection Pooling

The application uses TypeORM with connection pooling configured:
- Maximum pool size: 20 connections
- Connection timeout: 2000ms
- SSL support for AWS RDS (auto-detected)

## Authentication

### Admin Endpoints

All admin endpoints require JWT authentication:

```bash
# Login
POST /auth/login
Body: { "email": "admin@example.com", "password": "password" }

# Use token in requests
Authorization: Bearer <token>
```

### Guards

- `JwtAuthGuard` - Validates JWT token
- `AdminGuard` - Requires auth_level <= 2
- `SuperAdminGuard` - Requires auth_level === 1

## Migration Status

### ✅ Completed
- Project structure
- Database configuration
- Authentication module
- Products module (example)
- Swagger documentation

### 🔄 In Progress
- Converting remaining Express routes to NestJS controllers
- Creating feature modules (Orders, Customers, Payments, etc.)

### 📋 Pending
- Complete migration of all routes
- Testing all endpoints
- Performance optimization

## Development

### Adding a New Module

1. Create module directory:
```bash
mkdir -p src/modules/your-module
```

2. Create files:
- `your-module.module.ts` - Module definition
- `your-module.service.ts` - Business logic
- `your-module.controller.ts` - HTTP endpoints
- `dto/` - Data Transfer Objects (optional)

3. Register in `app.module.ts`:
```typescript
import { YourModule } from './modules/your-module/your-module.module';

@Module({
  imports: [
    // ... other modules
    YourModule,
  ],
})
```

### Example: Products Module

See `src/modules/products/` for a complete example of:
- Module structure
- Service with TypeORM repository
- Controller with guards
- Swagger decorators

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## License

UNLICENSED
