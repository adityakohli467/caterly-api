import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, Like, Between, In, DataSource } from 'typeorm';
import { ApiHistory } from '../../entities/ApiHistory.entity';

export interface HistoryFilters {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  eventType?: string;
  eventCategory?: string;
  resourceType?: string;
  userId?: number;
  customerId?: number;
  userType?: string;
  requestMethod?: string;
  requestPath?: string;
  isSuccessful?: boolean;
  search?: string;
}

@Injectable()
export class AdminHistoryService {
  private readonly logger = new Logger(AdminHistoryService.name);

  constructor(
    @InjectRepository(ApiHistory)
    private apiHistoryRepository: Repository<ApiHistory>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async getHistory(filters: HistoryFilters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        startDate,
        endDate,
        eventType,
        eventCategory,
        resourceType,
        userId,
        customerId,
        userType,
        requestMethod,
        requestPath,
        isSuccessful,
        search,
      } = filters;

      // Try to use repository, fallback to raw query if it fails
      let queryBuilder;
      try {
        queryBuilder = this.apiHistoryRepository.createQueryBuilder('history');
      } catch (error) {
        this.logger.warn('Repository query builder failed, using raw query', error);
        // Fallback to raw SQL query
        return this.getHistoryRaw(filters);
      }

      // Apply filters
    if (startDate && endDate) {
      queryBuilder.andWhere('history.created_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      queryBuilder.andWhere('history.created_at >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.andWhere('history.created_at <= :endDate', { endDate });
    }

    if (eventType) {
      queryBuilder.andWhere('history.event_type = :eventType', { eventType });
    }

    if (eventCategory) {
      queryBuilder.andWhere('history.event_category = :eventCategory', { eventCategory });
    }

    if (resourceType) {
      queryBuilder.andWhere('history.resource_type = :resourceType', { resourceType });
    }

    if (userId) {
      queryBuilder.andWhere('history.user_id = :userId', { userId });
    }

    if (customerId) {
      queryBuilder.andWhere('history.customer_id = :customerId', { customerId });
    }

    if (userType) {
      queryBuilder.andWhere('history.user_type = :userType', { userType });
    }

    if (requestMethod) {
      queryBuilder.andWhere('history.request_method = :requestMethod', { requestMethod });
    }

    if (requestPath) {
      queryBuilder.andWhere('history.request_path LIKE :requestPath', {
        requestPath: `%${requestPath}%`,
      });
    }

    if (isSuccessful !== undefined) {
      queryBuilder.andWhere('history.is_successful = :isSuccessful', { isSuccessful });
    }

    if (search) {
      queryBuilder.andWhere(
        '(history.request_path LIKE :search OR history.event_description LIKE :search OR history.username LIKE :search OR history.event_type LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination and ordering
    const skip = (page - 1) * limit;
    queryBuilder
      .orderBy('history.created_at', 'DESC')
      .skip(skip)
      .take(limit);

      // Don't use relations if they don't exist - just get the data directly
      const history = await queryBuilder.getMany();

      return {
        history,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      this.logger.error('Error getting history with repository, trying raw query:', error?.message);
      // If repository fails (e.g., metadata not found), try raw query as fallback
      try {
        return await this.getHistoryRaw(filters);
      } catch (rawError: any) {
        this.logger.error('Raw query also failed:', rawError?.message);
        throw new Error(`Failed to fetch history: ${error?.message || rawError?.message || 'Unknown error'}`);
      }
    }
  }

  async getHistoryById(historyId: number) {
    try {
      return await this.apiHistoryRepository.findOne({
        where: { history_id: historyId },
        // Remove relations if they don't exist
      });
    } catch (error: any) {
      this.logger.warn('Repository query failed for getHistoryById, using raw query', error?.message);
      // Fallback to raw SQL query
      try {
        const result = await this.dataSource.query(
          `SELECT * FROM api_history WHERE history_id = $1 LIMIT 1`,
          [historyId]
        );
        return result[0] || null;
      } catch (rawError: any) {
        this.logger.error('Raw query also failed for getHistoryById:', rawError?.message);
        throw new Error(`Failed to fetch history by ID: ${error?.message || rawError?.message || 'Unknown error'}`);
      }
    }
  }

  async getStatistics(filters: Partial<HistoryFilters> = {}) {
    try {
      const { startDate, endDate, userType } = filters;

      // Helper function to create base query builder with filters
      const createBaseQuery = () => {
        try {
          const qb = this.apiHistoryRepository.createQueryBuilder('history');
          if (startDate && endDate) {
            qb.andWhere('history.created_at BETWEEN :startDate AND :endDate', {
              startDate,
              endDate,
            });
          } else if (startDate) {
            qb.andWhere('history.created_at >= :startDate', { startDate });
          } else if (endDate) {
            qb.andWhere('history.created_at <= :endDate', { endDate });
          }
          if (userType) {
            qb.andWhere('history.user_type = :userType', { userType });
          }
          return qb;
        } catch (error: any) {
          this.logger.warn('Repository query builder failed in getStatistics, using raw query', error?.message);
          throw error; // Will be caught by outer try-catch
        }
      };

      // Get total count
      const total = await createBaseQuery().getCount();
      
      // Get successful count
      const successful = await createBaseQuery()
        .andWhere('history.is_successful = :isSuccessful', { isSuccessful: true })
        .getCount();
      const failed = total - successful;

      // Get counts by event type
      const eventTypeStats = await createBaseQuery()
        .select('history.event_type', 'event_type')
        .addSelect('COUNT(*)', 'count')
        .where('history.event_type IS NOT NULL')
        .groupBy('history.event_type')
        .getRawMany();

      // Get counts by event category
      const eventCategoryStats = await createBaseQuery()
        .select('history.event_category', 'event_category')
        .addSelect('COUNT(*)', 'count')
        .where('history.event_category IS NOT NULL')
        .groupBy('history.event_category')
        .getRawMany();

      // Get counts by request method
      const methodStats = await createBaseQuery()
        .select('history.request_method', 'request_method')
        .addSelect('COUNT(*)', 'count')
        .groupBy('history.request_method')
        .getRawMany();

      // Get average response time
      const avgResponseTime = await createBaseQuery()
        .select('AVG(history.response_time_ms)', 'avg')
        .getRawOne();

      return {
        total,
        successful,
        failed,
        successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : '0.00',
        averageResponseTime: avgResponseTime?.avg
          ? parseFloat(avgResponseTime.avg).toFixed(2)
          : '0.00',
        eventTypeStats: eventTypeStats || [],
        eventCategoryStats: eventCategoryStats || [],
        methodStats: methodStats || [],
      };
    } catch (error: any) {
      this.logger.error('Error getting statistics:', error);
      // Return default values on error
      return {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: '0.00',
        averageResponseTime: '0.00',
        eventTypeStats: [],
        eventCategoryStats: [],
        methodStats: [],
      };
    }
  }

  async getEventTypes() {
    try {
      const result = await this.apiHistoryRepository
        .createQueryBuilder('history')
        .select('DISTINCT history.event_type', 'event_type')
        .where('history.event_type IS NOT NULL')
        .getRawMany();

      return result.map((r) => r.event_type);
    } catch (error: any) {
      this.logger.warn('Repository query failed for getEventTypes, using raw query', error?.message);
      // Fallback to raw SQL query
      try {
        const result = await this.dataSource.query(
          `SELECT DISTINCT event_type FROM api_history WHERE event_type IS NOT NULL ORDER BY event_type`
        );
        return result.map((r: any) => r.event_type);
      } catch (rawError: any) {
        this.logger.error('Raw query also failed for getEventTypes:', rawError?.message);
        throw new Error(`Failed to fetch event types: ${error?.message || rawError?.message || 'Unknown error'}`);
      }
    }
  }

  async getEventCategories() {
    try {
      const result = await this.apiHistoryRepository
        .createQueryBuilder('history')
        .select('DISTINCT history.event_category', 'event_category')
        .where('history.event_category IS NOT NULL')
        .getRawMany();

      return result.map((r) => r.event_category);
    } catch (error: any) {
      this.logger.warn('Repository query failed for getEventCategories, using raw query', error?.message);
      // Fallback to raw SQL query
      try {
        const result = await this.dataSource.query(
          `SELECT DISTINCT event_category FROM api_history WHERE event_category IS NOT NULL ORDER BY event_category`
        );
        return result.map((r: any) => r.event_category);
      } catch (rawError: any) {
        this.logger.error('Raw query also failed for getEventCategories:', rawError?.message);
        throw new Error(`Failed to fetch event categories: ${error?.message || rawError?.message || 'Unknown error'}`);
      }
    }
  }

  async getResourceTypes() {
    try {
      const result = await this.apiHistoryRepository
        .createQueryBuilder('history')
        .select('DISTINCT history.resource_type', 'resource_type')
        .where('history.resource_type IS NOT NULL')
        .getRawMany();

      return result.map((r) => r.resource_type);
    } catch (error: any) {
      this.logger.warn('Repository query failed for getResourceTypes, using raw query', error?.message);
      // Fallback to raw SQL query
      try {
        const result = await this.dataSource.query(
          `SELECT DISTINCT resource_type FROM api_history WHERE resource_type IS NOT NULL ORDER BY resource_type`
        );
        return result.map((r: any) => r.resource_type);
      } catch (rawError: any) {
        this.logger.error('Raw query also failed for getResourceTypes:', rawError?.message);
        throw new Error(`Failed to fetch resource types: ${error?.message || rawError?.message || 'Unknown error'}`);
      }
    }
  }

  async deleteOldHistory(daysToKeep: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      const result = await this.apiHistoryRepository
        .createQueryBuilder()
        .delete()
        .where('created_at < :cutoffDate', { cutoffDate })
        .execute();

      return {
        deleted: result.affected || 0,
        message: `Deleted ${result.affected || 0} history records older than ${daysToKeep} days`,
      };
    } catch (error: any) {
      this.logger.warn('Repository query failed for deleteOldHistory, using raw query', error?.message);
      // Fallback to raw SQL query
      try {
        const result = await this.dataSource.query(
          `DELETE FROM api_history WHERE created_at < $1`,
          [cutoffDate]
        );
        const deleted = result[1] || 0; // result[1] is the row count in PostgreSQL
        return {
          deleted,
          message: `Deleted ${deleted} history records older than ${daysToKeep} days`,
        };
      } catch (rawError: any) {
        this.logger.error('Raw query also failed for deleteOldHistory:', rawError?.message);
        throw new Error(`Failed to delete old history: ${error?.message || rawError?.message || 'Unknown error'}`);
      }
    }
  }

  // Fallback method using raw SQL queries
  private async getHistoryRaw(filters: HistoryFilters = {}) {
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      eventType,
      eventCategory,
      resourceType,
      userId,
      customerId,
      userType,
      requestMethod,
      requestPath,
      isSuccessful,
      search,
    } = filters;

    let whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate && endDate) {
      whereConditions.push(`created_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(startDate, endDate);
      paramIndex += 2;
    } else if (startDate) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    } else if (endDate) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    if (eventType) {
      whereConditions.push(`event_type = $${paramIndex}`);
      params.push(eventType);
      paramIndex++;
    }

    if (eventCategory) {
      whereConditions.push(`event_category = $${paramIndex}`);
      params.push(eventCategory);
      paramIndex++;
    }

    if (resourceType) {
      whereConditions.push(`resource_type = $${paramIndex}`);
      params.push(resourceType);
      paramIndex++;
    }

    if (userId) {
      whereConditions.push(`user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    if (customerId) {
      whereConditions.push(`customer_id = $${paramIndex}`);
      params.push(customerId);
      paramIndex++;
    }

    if (userType) {
      whereConditions.push(`user_type = $${paramIndex}`);
      params.push(userType);
      paramIndex++;
    }

    if (requestMethod) {
      whereConditions.push(`request_method = $${paramIndex}`);
      params.push(requestMethod);
      paramIndex++;
    }

    if (requestPath) {
      whereConditions.push(`request_path LIKE $${paramIndex}`);
      params.push(`%${requestPath}%`);
      paramIndex++;
    }

    if (isSuccessful !== undefined) {
      whereConditions.push(`is_successful = $${paramIndex}`);
      params.push(isSuccessful);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(request_path LIKE $${paramIndex} OR event_description LIKE $${paramIndex} OR username LIKE $${paramIndex} OR event_type LIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM api_history ${whereClause}`;
    const countResult = await this.dataSource.query(countQuery, params);
    const total = parseInt(countResult[0]?.count || '0');

    // Get paginated results
    const skip = (page - 1) * limit;
    const query = `
      SELECT * FROM api_history 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, skip);
    const history = await this.dataSource.query(query, params);

    return {
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

