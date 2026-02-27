import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminCategoriesService {
  private readonly logger = new Logger(AdminCategoriesService.name);

  constructor(private dataSource: DataSource) { }

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

    sqlQuery += ' ORDER BY c.sort_order ASC, c.category_id DESC';
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
    const { category_name, parent_category_id, sort_order = 0 } = createCategoryDto;

    if (!category_name) {
      throw new BadRequestException('Category name is required');
    }

    const result = await this.dataSource.query(
      `INSERT INTO category (category_name, parent_category_id, sort_order) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [category_name, parent_category_id || null, sort_order],
    );

    return { category: result[0], message: 'Category created successfully' };
  }

  async update(id: number, updateCategoryDto: any): Promise<any> {
    const { category_name, parent_category_id, sort_order } = updateCategoryDto;

    let updateQuery = 'UPDATE category SET ';
    const updateParams: any[] = [];
    let paramIndex = 1;

    if (category_name !== undefined) {
      updateQuery += `category_name = $${paramIndex++}, `;
      updateParams.push(category_name);
    }
    if (parent_category_id !== undefined) {
      updateQuery += `parent_category_id = $${paramIndex++}, `;
      updateParams.push(parent_category_id || null);
    }
    if (sort_order !== undefined) {
      updateQuery += `sort_order = $${paramIndex++}, `;
      updateParams.push(sort_order);
    }

    // Remove trailing comma and space
    updateQuery = updateQuery.slice(0, -2);
    updateQuery += ` WHERE category_id = $${paramIndex} RETURNING *`;
    updateParams.push(id);

    const result = await this.dataSource.query(updateQuery, updateParams);

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

  async reorder(reorderDto: { category_id: number; sort_order: number }[]): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of reorderDto) {
        await queryRunner.query(
          'UPDATE category SET sort_order = $1 WHERE category_id = $2',
          [item.sort_order, item.category_id]
        );
      }
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error reordering categories:', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
