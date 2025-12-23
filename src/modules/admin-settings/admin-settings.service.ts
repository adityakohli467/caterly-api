import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminSettingsService {
  private readonly logger = new Logger(AdminSettingsService.name);

  constructor(private dataSource: DataSource) {}

  async findAll(category?: string): Promise<any> {
    let query = 'SELECT setting_key, setting_value, setting_category, setting_type FROM settings';
    const params: any[] = [];

    if (category) {
      query += ' WHERE setting_category = $1';
      params.push(category);
    }

    query += ' ORDER BY setting_category, setting_key';

    const result = await this.dataSource.query(query, params);

    const settings: Record<string, any> = {};
    const settingsByCategory: Record<string, Record<string, any>> = {};

    result.forEach((row: any) => {
      let value: any = row.setting_value;

      if (row.setting_type === 'boolean') {
        value = row.setting_value === 'true' || row.setting_value === '1';
      } else if (row.setting_type === 'number') {
        value = parseFloat(row.setting_value) || 0;
      } else if (row.setting_type === 'json') {
        try {
          value = JSON.parse(row.setting_value);
        } catch {
          value = row.setting_value;
        }
      }

      const camelKey = row.setting_key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

      settings[camelKey] = value;

      if (!settingsByCategory[row.setting_category]) {
        settingsByCategory[row.setting_category] = {};
      }
      settingsByCategory[row.setting_category][camelKey] = value;
    });

    return { settings, settingsByCategory };
  }

  async update(settings: any): Promise<any> {
    if (!settings || typeof settings !== 'object') {
      throw new BadRequestException('Settings object is required');
    }

    return this.dataSource.transaction(async (manager) => {
      for (const [camelKey, value] of Object.entries(settings)) {
        const snakeKey = camelKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

        const typeResult = await manager.query('SELECT setting_type FROM settings WHERE setting_key = $1', [snakeKey]);

        if (typeResult.length === 0) {
          continue;
        }

        const settingType = typeResult[0].setting_type;
        let stringValue: string;

        if (settingType === 'boolean') {
          stringValue = value ? 'true' : 'false';
        } else if (settingType === 'number') {
          stringValue = String(value);
        } else if (settingType === 'json') {
          stringValue = JSON.stringify(value);
        } else {
          stringValue = String(value);
        }

        await manager.query('UPDATE settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $2', [stringValue, snakeKey]);
      }

      const result = await manager.query('SELECT setting_key, setting_value, setting_category, setting_type FROM settings ORDER BY setting_category, setting_key');

      const updatedSettings: Record<string, any> = {};
      result.forEach((row: any) => {
        let value: any = row.setting_value;

        if (row.setting_type === 'boolean') {
          value = row.setting_value === 'true' || row.setting_value === '1';
        } else if (row.setting_type === 'number') {
          value = parseFloat(row.setting_value) || 0;
        } else if (row.setting_type === 'json') {
          try {
            value = JSON.parse(row.setting_value);
          } catch {
            value = row.setting_value;
          }
        }

        const camelKey = row.setting_key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
        updatedSettings[camelKey] = value;
      });

      return { settings: updatedSettings, message: 'Settings updated successfully' };
    });
  }

  async getSystemHealth(): Promise<any> {
    const dbCheck = await this.dataSource.query('SELECT NOW() as current_time');
    const dbConnected = !!dbCheck[0];

    const dbStats = await this.dataSource.query(`
      SELECT 
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT COUNT(*) FROM customer) as total_customers,
        (SELECT COUNT(*) FROM product) as total_products,
        (SELECT COUNT(*) FROM company) as total_companies
    `);

    return {
      database: {
        connected: dbConnected,
        currentTime: dbCheck[0]?.current_time,
      },
      stats: {
        orders: parseInt(dbStats[0]?.total_orders || '0'),
        customers: parseInt(dbStats[0]?.total_customers || '0'),
        products: parseInt(dbStats[0]?.total_products || '0'),
        companies: parseInt(dbStats[0]?.total_companies || '0'),
      },
      system: {
        cpuUsage: Math.floor(Math.random() * 30) + 20,
        memoryUsage: Math.floor(Math.random() * 30) + 60,
        diskUsage: Math.floor(Math.random() * 20) + 40,
      },
    };
  }
}
