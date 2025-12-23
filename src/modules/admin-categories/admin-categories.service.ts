import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminCategoriesService {
  private readonly logger = new Logger(AdminCategoriesService.name);

  constructor(private dataSource: DataSource) {}

  async findAll(query: any): Promise<any> {
    const { limit = 20, offset = 0, search } = query;

    let sqlQuery = `
      SELECT 
        c.*,
        pc.category_name as parent_category_name
      FROM category c
      LEFT JOIN category pc ON c.parent_category_id = pc.category_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      sqlQuery += ` AND c.category_name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sqlQuery += ' ORDER BY c.category_id DESC';
    sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(sqlQuery, params);

    let countQuery = 'SELECT COUNT(*) FROM category c WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND c.category_name ILIKE $${countParamIndex}`;
      countParams.push(`%${search}%`);
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return { categories: result, count, limit: Number(limit), offset: Number(offset) };
  }

  async findOne(id: number): Promise<any> {
    const result = await this.dataSource.query(
      `SELECT 
        c.*,
        pc.category_name as parent_category_name
      FROM category c
      LEFT JOIN category pc ON c.parent_category_id = pc.category_id
      WHERE c.category_id = $1`,
      [id],
    );

    if (result.length === 0) {
      throw new NotFoundException('Category not found');
    }

    return { category: result[0] };
  }

  async create(createCategoryDto: any): Promise<any> {
    const { category_name, parent_category_id } = createCategoryDto;

    if (!category_name) {
      throw new BadRequestException('Category name is required');
    }

    const result = await this.dataSource.query(
      `INSERT INTO category (category_name, parent_category_id) 
       VALUES ($1, $2) 
       RETURNING *`,
      [category_name, parent_category_id || null],
    );

    return { category: result[0], message: 'Category created successfully' };
  }

  async update(id: number, updateCategoryDto: any): Promise<any> {
    const { category_name, parent_category_id } = updateCategoryDto;

    const result = await this.dataSource.query(
      `UPDATE category 
       SET category_name = $1, parent_category_id = $2
       WHERE category_id = $3
       RETURNING *`,
      [category_name, parent_category_id || null, id],
    );

    if (result.length === 0) {
      throw new NotFoundException('Category not found');
    }

    return { category: result[0], message: 'Category updated successfully' };
  }

  async delete(id: number): Promise<void> {
    const result = await this.dataSource.query('DELETE FROM category WHERE category_id = $1 RETURNING *', [id]);

    if (result.length === 0) {
      throw new NotFoundException('Category not found');
    }
  }
}
