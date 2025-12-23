import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminLocationsService {
  private readonly logger = new Logger(AdminLocationsService.name);

  constructor(private dataSource: DataSource) {}

  async findAll(query: any): Promise<any> {
    const { limit = 20, offset = 0, search } = query;

    let sqlQuery = `SELECT * FROM locations WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      sqlQuery += ` AND (location_name ILIKE $${paramIndex} OR remittance_email ILIKE $${paramIndex} OR account_name ILIKE $${paramIndex} OR company_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sqlQuery += ' ORDER BY location_id DESC';
    sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(sqlQuery, params);

    let countQuery = 'SELECT COUNT(*) FROM locations WHERE 1=1';
    const countParams: any[] = [];

    if (search) {
      countQuery += ` AND (location_name ILIKE $1 OR remittance_email ILIKE $1 OR account_name ILIKE $1 OR company_name ILIKE $1)`;
      countParams.push(`%${search}%`);
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return { locations: result, count, limit: Number(limit), offset: Number(offset) };
  }

  async findOne(id: number): Promise<any> {
    const result = await this.dataSource.query('SELECT * FROM locations WHERE location_id = $1', [id]);

    if (result.length === 0) {
      throw new NotFoundException('Location not found');
    }

    return { location: result[0] };
  }

  async create(createLocationDto: any): Promise<any> {
    const {
      location_name,
      remittance_email,
      account_name,
      account_number,
      contact,
      abn,
      company_name,
      bsb,
      pickup_address,
      post_codes,
      location_status,
    } = createLocationDto;

    const result = await this.dataSource.query(
      `INSERT INTO locations (
        location_name, 
        remittance_email, 
        account_name, 
        account_number, 
        contact, 
        abn, 
        company_name, 
        bsb, 
        pickup_address,
        post_codes,
        location_status,
        date_created
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_DATE) 
      RETURNING *`,
      [
        location_name,
        remittance_email,
        account_name,
        account_number,
        contact,
        abn,
        company_name,
        bsb,
        pickup_address,
        post_codes,
        location_status || 1,
      ],
    );

    return { location: result[0], message: 'Location created successfully' };
  }

  async update(id: number, updateLocationDto: any): Promise<any> {
    const {
      location_name,
      remittance_email,
      account_name,
      account_number,
      contact,
      abn,
      company_name,
      bsb,
      pickup_address,
      post_codes,
      location_status,
    } = updateLocationDto;

    const result = await this.dataSource.query(
      `UPDATE locations 
       SET 
         location_name = $1, 
         remittance_email = $2, 
         account_name = $3, 
         account_number = $4, 
         contact = $5, 
         abn = $6, 
         company_name = $7, 
         bsb = $8, 
         pickup_address = $9,
         post_codes = $10,
         location_status = $11
       WHERE location_id = $12
       RETURNING *`,
      [
        location_name,
        remittance_email,
        account_name,
        account_number,
        contact,
        abn,
        company_name,
        bsb,
        pickup_address,
        post_codes,
        location_status,
        id,
      ],
    );

    if (result.length === 0) {
      throw new NotFoundException('Location not found');
    }

    return { location: result[0], message: 'Location updated successfully' };
  }

  async delete(id: number): Promise<void> {
    const result = await this.dataSource.query('DELETE FROM locations WHERE location_id = $1 RETURNING *', [id]);

    if (result.length === 0) {
      throw new NotFoundException('Location not found');
    }
  }
}
