import { NestFactory } from '@nestjs/core';
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
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for webhook signature verification
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
  app.getHttpAdapter().get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Redirect root to Swagger docs
  app.getHttpAdapter().get('/', (req, res) => {
    res.redirect('/api-docs');
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
