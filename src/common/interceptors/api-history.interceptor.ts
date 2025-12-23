import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ApiHistoryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiHistoryInterceptor.name);
  private isTableAvailable: boolean | null = null;

  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Skip logging for health checks and swagger docs
    const skipPaths = ['/health', '/api-docs', '/favicon.ico'];
    if (skipPaths.some(path => request.path.includes(path))) {
      return next.handle();
    }

    // Check if table exists (lazy check) - non-blocking
    if (this.isTableAvailable === null) {
      // Check table availability asynchronously without blocking
      this.checkTableAvailability().catch(() => {
        // Silently handle check failure
      });
      // For first request, assume table is available and let the insert handle errors
      this.isTableAvailable = true;
    }

    if (this.isTableAvailable === false) {
      return next.handle();
    }

    // Extract user information from request
    const user = (request as any).user || null;
    const userId = user?.user_id || user?.id || null;
    const username = user?.username || null;

    // Determine user type
    let userType = 'public';
    if (request.path.startsWith('/admin')) {
      userType = 'admin';
    } else if (request.path.startsWith('/store')) {
      userType = 'store';
    }

    // Extract customer ID if available
    const customerId = user?.customer_id || (request.body as any)?.customer_id || null;

    // Parse request body (limit size to prevent huge logs)
    let requestBody: string | null = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const bodyStr = JSON.stringify(request.body || {});
        // Limit to 10KB for request body
        requestBody = bodyStr.length > 10000 ? bodyStr.substring(0, 10000) + '... [truncated]' : bodyStr;
      } catch (e) {
        requestBody = '[unable to serialize]';
      }
    }

    // Parse query parameters
    const queryStr = Object.keys(request.query).length > 0 
      ? JSON.stringify(request.query) 
      : null;

    // Parse headers (exclude sensitive data)
    const headersToLog: any = {};
    Object.keys(request.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      // Exclude sensitive headers
      if (!['authorization', 'cookie', 'x-api-key'].includes(lowerKey)) {
        headersToLog[key] = request.headers[key];
      } else {
        headersToLog[key] = '[redacted]';
      }
    });
    const headersStr = JSON.stringify(headersToLog);

    // Determine event type and category
    const eventType = this.getEventType(request.method, request.path, request.body);
    const eventCategory = this.getEventCategory(request.path);
    const resourceType = this.getResourceType(request.path);
    const resourceId = this.getResourceId(request.path, request.body);

    // Create event description with more details
    const eventDescription = this.getEventDescription(
      request.method,
      request.path,
      resourceType,
      resourceId,
      request.body,
    );

    return next.handle().pipe(
      tap(async (data) => {
        // Success response
        const responseTime = Date.now() - startTime;
        await this.logApiCall({
          request,
          response,
          userId,
          username,
          customerId,
          userType,
          requestBody,
          queryStr,
          headersStr,
          responseStatus: response.statusCode,
          responseBody: this.serializeResponse(data),
          responseTime,
          eventType,
          eventCategory,
          resourceType,
          resourceId,
          eventDescription,
          isSuccessful: true,
        });
      }),
      catchError(async (error) => {
        // Error response
        const responseTime = Date.now() - startTime;
        await this.logApiCall({
          request,
          response,
          userId,
          username,
          customerId,
          userType,
          requestBody,
          queryStr,
          headersStr,
          responseStatus: error.status || 500,
          responseBody: this.serializeError(error),
          responseTime,
          eventType,
          eventCategory,
          resourceType,
          resourceId,
          eventDescription,
          isSuccessful: false,
          errorMessage: error.message || 'Unknown error',
          errorStack: error.stack || null,
        });
        throw error;
      }),
    );
  }

  private async checkTableAvailability(): Promise<void> {
    try {
      await this.dataSource.query('SELECT 1 FROM api_history LIMIT 1');
      this.isTableAvailable = true;
    } catch (error) {
      // Table doesn't exist or not accessible
      this.isTableAvailable = false;
      this.logger.warn('ApiHistory table not available, skipping history logging');
    }
  }

  private async logApiCall(data: {
    request: Request;
    response: Response;
    userId: number | null;
    username: string | null;
    customerId: number | null;
    userType: string;
    requestBody: string | null;
    queryStr: string | null;
    headersStr: string;
    responseStatus: number;
    responseBody: string | null;
    responseTime: number;
    eventType: string;
    eventCategory: string;
    resourceType: string | null;
    resourceId: number | null;
    eventDescription: string;
    isSuccessful: boolean;
    errorMessage?: string;
    errorStack?: string;
    }) {
    if (!this.isTableAvailable) {
      return; // Skip if table not available
    }
    
    try {
      // Use raw SQL insert to avoid entity metadata issues
      const insertQuery = `
        INSERT INTO api_history (
          request_method, request_url, request_path, request_query, request_headers,
          request_body, request_ip, user_agent, response_status, response_body,
          response_time_ms, user_id, username, customer_id, user_type,
          event_type, event_category, event_description, resource_type, resource_id,
          is_successful, error_message, error_stack, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, CURRENT_TIMESTAMP)
      `;

      await this.dataSource.query(insertQuery, [
        data.request.method,
        data.request.url,
        data.request.path,
        data.queryStr || null,
        data.headersStr || null,
        data.requestBody || null,
        data.request.ip || (data.request.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown',
        data.request.headers['user-agent'] || null,
        data.responseStatus || null,
        data.responseBody || null,
        data.responseTime || null,
        data.userId || null,
        data.username || null,
        data.customerId || null,
        data.userType,
        data.eventType || null,
        data.eventCategory || null,
        data.eventDescription || null,
        data.resourceType || null,
        data.resourceId || null,
        data.isSuccessful,
        data.errorMessage || null,
        data.errorStack || null,
      ]);
    } catch (error) {
      // Don't let logging errors break the API
      // Only log error if it's not a table-not-found error (to avoid spam)
      if (!error.message?.includes('does not exist') && !error.message?.includes('relation "api_history"')) {
        this.logger.error('Failed to log API history', error);
      }
      // Mark table as unavailable if we get a table-not-found error
      if (error.message?.includes('does not exist') || error.message?.includes('relation "api_history"')) {
        this.isTableAvailable = false;
      }
    }
  }

  private serializeResponse(data: any): string | null {
    if (!data) return null;
    try {
      const serialized = JSON.stringify(data);
      // Limit to 5KB for response body
      return serialized.length > 5000 ? serialized.substring(0, 5000) + '... [truncated]' : serialized;
    } catch (e) {
      return '[unable to serialize]';
    }
  }

  private serializeError(error: any): string | null {
    try {
      const errorObj = {
        message: error.message,
        status: error.status,
        ...(error.response ? { response: error.response } : {}),
      };
      const serialized = JSON.stringify(errorObj);
      return serialized.length > 5000 ? serialized.substring(0, 5000) + '... [truncated]' : serialized;
    } catch (e) {
      return `Error: ${error.message || 'Unknown error'}`;
    }
  }

  private getEventType(method: string, path: string, body?: any): string {
    // Authentication events
    if (path.includes('/auth/login')) return 'login';
    if (path.includes('/auth/logout')) return 'logout';
    if (path.includes('/auth/register')) return 'register';
    if (path.includes('/auth/reset-password')) return 'password_reset';
    
    // Specific event types based on path
    if (path.includes('/invoices/generate')) return 'invoice_generate';
    if (path.includes('/invoices/send')) return 'invoice_send';
    if (path.includes('/permissions')) return 'permission_update';
    if (path.includes('/roles') && (method === 'PUT' || method === 'PATCH')) return 'role_permission_update';
    
    // Standard CRUD operations
    if (method === 'POST') return 'create';
    if (method === 'PUT' || method === 'PATCH') return 'update';
    if (method === 'DELETE') return 'delete';
    if (method === 'GET') return 'read';
    
    return 'api_call';
  }

  private getEventCategory(path: string): string {
    if (path.includes('/auth')) return 'auth';
    if (path.includes('/products')) return 'products';
    if (path.includes('/orders')) return 'orders';
    if (path.includes('/customers')) return 'customers';
    if (path.includes('/quotes')) return 'quotes';
    if (path.includes('/subscriptions')) return 'subscriptions';
    if (path.includes('/coupons')) return 'coupons';
    if (path.includes('/blogs')) return 'blogs';
    if (path.includes('/reviews')) return 'reviews';
    if (path.includes('/payments')) return 'payments';
    if (path.includes('/users')) return 'users';
    if (path.includes('/companies')) return 'companies';
    if (path.includes('/departments')) return 'departments';
    if (path.includes('/categories')) return 'categories';
    if (path.includes('/options')) return 'options';
    if (path.includes('/locations')) return 'locations';
    if (path.includes('/settings')) return 'settings';
    if (path.includes('/upload')) return 'upload';
    if (path.includes('/cart')) return 'cart';
    if (path.includes('/contact')) return 'contact';
    if (path.includes('/wholesale')) return 'wholesale';
    if (path.includes('/roles')) return 'roles';
    if (path.includes('/permissions')) return 'permissions';
    if (path.includes('/invoices')) return 'invoices';
    return 'other';
  }

  private getResourceType(path: string): string | null {
    if (path.includes('/products')) return 'product';
    if (path.includes('/orders')) return 'order';
    if (path.includes('/customers')) return 'customer';
    if (path.includes('/quotes')) return 'quote';
    if (path.includes('/subscriptions')) return 'subscription';
    if (path.includes('/coupons')) return 'coupon';
    if (path.includes('/blogs')) return 'blog';
    if (path.includes('/reviews')) return 'review';
    if (path.includes('/users')) return 'user';
    if (path.includes('/companies')) return 'company';
    if (path.includes('/departments')) return 'department';
    if (path.includes('/categories')) return 'category';
    if (path.includes('/options')) return 'option';
    if (path.includes('/locations')) return 'location';
    if (path.includes('/roles')) return 'role';
    if (path.includes('/permissions')) return 'permission';
    if (path.includes('/invoices')) return 'invoice';
    if (path.includes('/payments')) return 'payment';
    if (path.includes('/settings')) return 'setting';
    return null;
  }

  private getResourceId(path: string, body: any): number | null {
    // Try to extract ID from URL path (e.g., /products/123)
    const pathMatch = path.match(/\/(\d+)(?:\/|$)/);
    if (pathMatch) {
      return parseInt(pathMatch[1], 10);
    }
    // Try to extract ID from body
    if (body) {
      const idFields = [
        'id', 
        'product_id', 
        'order_id', 
        'customer_id', 
        'user_id', 
        'quote_id', 
        'subscription_id',
        'coupon_id',
        'company_id',
        'department_id',
        'role_id',
        'invoice_id',
        'category_id',
        'option_id',
        'location_id',
        'blog_id',
        'review_id',
      ];
      for (const field of idFields) {
        if (body[field] !== undefined && body[field] !== null) {
          const value = parseInt(body[field], 10);
          if (!isNaN(value)) {
            return value;
          }
        }
      }
    }
    return null;
  }

  private getEventDescription(
    method: string,
    path: string,
    resourceType: string | null,
    resourceId: number | null,
    body?: any,
  ): string {
    const resource = resourceType || 'resource';
    const id = resourceId ? ` #${resourceId}` : '';
    
    // Specific descriptions for critical operations
    if (path.includes('/invoices/generate')) {
      return `Generate Invoice for Order #${body?.order_id || resourceId || 'N/A'}`;
    }
    
    if (path.includes('/invoices/send')) {
      return `Send Invoice Email for Order #${resourceId || 'N/A'}`;
    }
    
    if (path.includes('/users') && method === 'POST') {
      const username = body?.username || 'User';
      return `Create User: ${username}${id}`;
    }
    
    if (path.includes('/users') && (method === 'PUT' || method === 'PATCH')) {
      const username = body?.username || 'User';
      return `Update User: ${username}${id}`;
    }
    
    if (path.includes('/roles') && (method === 'PUT' || method === 'PATCH')) {
      const roleName = body?.role_name || 'Role';
      return `Update Role Permissions: ${roleName}${id}`;
    }
    
    if (path.includes('/roles') && method === 'POST') {
      const roleName = body?.role_name || 'Role';
      return `Create Role: ${roleName}${id}`;
    }
    
    if (path.includes('/coupons') && method === 'POST') {
      const code = body?.coupon_code || 'Coupon';
      return `Create Coupon: ${code}${id}`;
    }
    
    if (path.includes('/coupons') && (method === 'PUT' || method === 'PATCH')) {
      const code = body?.coupon_code || 'Coupon';
      return `Update Coupon: ${code}${id}`;
    }
    
    if (path.includes('/customers') && method === 'POST') {
      const name = body?.firstname || body?.lastname 
        ? `${body.firstname || ''} ${body.lastname || ''}`.trim() 
        : 'Customer';
      return `Create Customer: ${name}${id}`;
    }
    
    if (path.includes('/companies') && method === 'POST') {
      const name = body?.company_name || 'Company';
      return `Create Company: ${name}${id}`;
    }
    
    if (path.includes('/departments') && method === 'POST') {
      const name = body?.department_name || 'Department';
      return `Create Department: ${name}${id}`;
    }
    
    if (path.includes('/departments') && (method === 'PUT' || method === 'PATCH')) {
      const name = body?.department_name || 'Department';
      return `Update Department: ${name}${id}`;
    }
    
    if (path.includes('/products') && method === 'POST') {
      const name = body?.product_name || 'Product';
      return `Create Product: ${name}${id}`;
    }
    
    if (path.includes('/products') && (method === 'PUT' || method === 'PATCH')) {
      const name = body?.product_name || 'Product';
      return `Update Product: ${name}${id}`;
    }
    
    if (path.includes('/orders') && method === 'POST') {
      return `Create Order${id}`;
    }
    
    if (path.includes('/orders') && (method === 'PUT' || method === 'PATCH')) {
      return `Update Order${id}`;
    }
    
    if (path.includes('/quotes') && method === 'POST') {
      return `Create Quote${id}`;
    }
    
    if (path.includes('/quotes') && (method === 'PUT' || method === 'PATCH')) {
      return `Update Quote${id}`;
    }
    
    // Standard descriptions
    switch (method) {
      case 'GET':
        return `Read ${resource}${id}`;
      case 'POST':
        return `Create ${resource}${id}`;
      case 'PUT':
      case 'PATCH':
        return `Update ${resource}${id}`;
      case 'DELETE':
        return `Delete ${resource}${id}`;
      default:
        return `${method} ${path}`;
    }
  }
}

