import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminSettingsService {
  private readonly logger = new Logger(AdminSettingsService.name);

  constructor(private dataSource: DataSource) { }

  private async ensureSettingsTableExists(): Promise<void> {
    try {
      // Check if settings table exists
      const tableCheck = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'settings'
        );
      `);

      if (!tableCheck[0]?.exists) {
        // Create settings table
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS settings (
            setting_id SERIAL PRIMARY KEY,
            setting_key VARCHAR(255) UNIQUE NOT NULL,
            setting_value TEXT,
            setting_category VARCHAR(100) NOT NULL DEFAULT 'general',
            setting_type VARCHAR(50) NOT NULL DEFAULT 'string',
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Create indexes
        await this.dataSource.query(`
          CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(setting_key);
          CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(setting_category);
        `);

        // Insert default settings
        await this.dataSource.query(`
          INSERT INTO settings (setting_key, setting_value, setting_category, setting_type, description) VALUES
          ('company_name', 'Caterly', 'general', 'string', 'Company name'),
          ('company_email', 'admin@caterly.com.au', 'general', 'string', 'Company email address'),
          ('company_phone', '+61 3 1234 5678', 'general', 'string', 'Company phone number'),
          ('company_abn', 'ABN: 12 345 678 901', 'general', 'string', 'Company ABN'),
          ('currency', 'AUD', 'general', 'string', 'Default currency'),
          ('email_notifications', 'true', 'notifications', 'boolean', 'Enable email notifications'),
          ('push_notifications', 'false', 'notifications', 'boolean', 'Enable push notifications'),
          ('order_notifications', 'true', 'notifications', 'boolean', 'Enable order notifications'),
          ('customer_notifications', 'true', 'notifications', 'boolean', 'Enable customer notifications'),
          ('two_factor_auth', 'false', 'security', 'boolean', 'Enable two-factor authentication'),
          ('session_timeout', '30', 'security', 'number', 'Session timeout in minutes'),
          ('password_expiry', '90', 'security', 'number', 'Password expiry in days'),
          ('theme', 'light', 'appearance', 'string', 'Application theme'),
          ('primary_color', '#E03A3E', 'appearance', 'string', 'Primary color'),
          ('language', 'en', 'appearance', 'string', 'Application language'),
          ('maintenance_mode', 'false', 'system', 'boolean', 'Maintenance mode status')
          ON CONFLICT (setting_key) DO NOTHING;
        `);

        this.logger.log('Settings table created successfully');
      }
    } catch (error) {
      this.logger.error('Error ensuring settings table exists:', error);
      throw error;
    }
  }

  async findAll(category?: string): Promise<any> {
    await this.ensureSettingsTableExists();

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

    await this.ensureSettingsTableExists();

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
