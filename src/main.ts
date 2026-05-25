// Set default timezone to Australia/Sydney for the entire application
process.env.TZ = 'Australia/Sydney';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join, extname, basename } from 'path';
import { existsSync } from 'fs';
import { ValidationPipe, HttpException, HttpStatus } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import * as crypto from 'crypto';

// Ensure crypto is available globally for TypeORM
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = crypto as any;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Enable raw body for webhook signature verification
    // Enable all log levels so debug/verbose messages are printed to console
    logger: ['error','warn','log','debug','verbose'],
  });

  // Enable CORS - Allow all origins for AWS deployment
  // Explicitly allow all origins to fix storefront CORS issues
  app.enableCors({
    origin: '*', // Allow all origins explicitly - fixes AWS CORS issues
    credentials: false, // Set to false when using origin: '*' (browser requirement)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'CSRF-TOKEN',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    exposedHeaders: [
      'Content-Type',
      'Authorization',
      'Access-Control-Allow-Origin',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400, // 24 hours - cache preflight requests
  });

  // Global exception filter for consistent error messages
  app.useGlobalFilters(new HttpExceptionFilter());

  // Serve static uploads directory statically
  const uploadsPath = join(process.cwd(), 'uploads');
  console.log(`\n📂 Serving static assets from: ${uploadsPath}`);
  console.log(`🌐 Static prefix: /uploads`);

  // Extension fallback middleware: try .webp when .png/.jpg/.jpeg is not found
  app.use('/uploads', (req, res, next) => {
    const ext = extname(req.path).toLowerCase();
    if (['.png', '.jpg', '.jpeg'].includes(ext)) {
      const filePath = join(uploadsPath, req.path);
      if (!existsSync(filePath)) {
        const webpPath = filePath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
        if (existsSync(webpPath)) {
          req.url = req.url.replace(/\.(png|jpg|jpeg)$/i, '.webp');
        }
      }
    }
    next();
  });

  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads',
    // Ensure CORS headers are set for static assets to fix storefront display issues
    setHeaders: (res) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    },
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // Allow extra properties to match backend-medusa behavior
      exceptionFactory: (errors) => {
        // Format validation errors with clear messages
        const formattedErrors = errors.map((error) => {
          const constraints = error.constraints || {};
          const messages = Object.values(constraints);
          return {
            field: error.property,
            message: messages[0] || `${error.property} is invalid`,
          };
        });
        return new HttpException(
          {
            message: 'Validation failed',
            errors: formattedErrors,
          },
          HttpStatus.BAD_REQUEST,
        );
      },
    }),
  );

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('STX API')
    .setDescription('STX API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'STX API Documentation',
  });

  // Health check endpoint
  app.getHttpAdapter().get('/health', (req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Redirect root to Swagger docs
  app.getHttpAdapter().get('/', (req: any, res: any) => {
    res.redirect('/api-docs');
  });

  // Redirect /Admin to the Admin Portal (Amplify)
  app.getHttpAdapter().get('/Admin', (req: any, res: any) => {
    const adminUrl = process.env.ADMIN_PORTAL_URL || 'https://main.d2u5hnzeh0mjr6.amplifyapp.com';
    res.redirect(adminUrl);
  });

  const port = process.env.PORT || 9000;
  await app.listen(port);

  console.log('\n' + '='.repeat(60));
  console.log('🚀 STX API Server Started Successfully!');
  console.log('='.repeat(60));
  console.log(`📖 Swagger Documentation: http://localhost:${port}/api-docs`);
  console.log(`💚 Health Check:         http://localhost:${port}/health`);
  console.log(`🔐 Auth API:              http://localhost:${port}/auth`);
  console.log('='.repeat(60) + '\n');
}
bootstrap();
