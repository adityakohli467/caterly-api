import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let errorDetails: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message || message;
        
        // Include validation errors if present
        if (responseObj.message && Array.isArray(responseObj.message)) {
          errorDetails = responseObj.message;
          message = 'Validation failed';
        } else if (responseObj.error) {
          errorDetails = responseObj.error;
        }
      } else {
        message = exception.message || message;
      }
    } else if (exception instanceof QueryFailedError) {
      // Handle database constraint errors
      const errorMessage = exception.message || '';
      if (errorMessage.includes('violates not-null constraint')) {
        status = HttpStatus.BAD_REQUEST;
        const fieldMatch = errorMessage.match(/column "([^"]+)" of relation/);
        if (fieldMatch) {
          const fieldName = fieldMatch[1]
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          message = `${fieldName} is required`;
        } else {
          message = 'Required field is missing';
        }
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Database error occurred';
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    // Log error for debugging (only log non-401 errors to avoid spam)
    if (status !== HttpStatus.UNAUTHORIZED) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Build error response
    const errorResponse: any = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Include error details if available
    if (errorDetails) {
      errorResponse.errors = errorDetails;
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      errorResponse.stack = exception.stack;
    }

    response.status(status).json(errorResponse);
  }
}

