import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminOptionsService {
  private readonly logger = new Logger(AdminOptionsService.name);

  constructor(private dataSource: DataSource) {}

  async findAll(query: any): Promise<any> {
    const { limit = 20, offset = 0, search } = query;

    let sqlQuery = `
      SELECT 
        o.*,
        (
          SELECT json_agg(
            json_build_object(
              'option_value_id', ov.option_value_id,
              'name', ov.name,
              'sort_order', ov.sort_order,
              'standard_price', ov.standard_price,
              'wholesale_price', ov.wholesale_price
            ) ORDER BY ov.sort_order
          )
          FROM option_value ov
          WHERE ov.option_id = o.option_id
        ) as values
      FROM options o
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      sqlQuery += ` AND o.name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sqlQuery += ' ORDER BY o.option_id DESC';
    sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(sqlQuery, params);

    let countQuery = 'SELECT COUNT(*) FROM options o WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND o.name ILIKE $${countParamIndex}`;
      countParams.push(`%${search}%`);
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return { options: result, count, limit: Number(limit), offset: Number(offset) };
  }

  async findOne(id: number): Promise<any> {
    const result = await this.dataSource.query(
      `SELECT 
        o.*,
        (
          SELECT json_agg(
            json_build_object(
              'option_value_id', ov.option_value_id,
              'name', ov.name,
              'sort_order', ov.sort_order,
              'standard_price', ov.standard_price,
              'wholesale_price', ov.wholesale_price
            ) ORDER BY ov.sort_order
          )
          FROM option_value ov
          WHERE ov.option_id = o.option_id
        ) as values
      FROM options o
      WHERE o.option_id = $1`,
      [id],
    );

    if (result.length === 0) {
      throw new NotFoundException('Option not found');
    }

    return { option: result[0] };
  }

  async create(createOptionDto: any): Promise<any> {
    const { name, option_type, values } = createOptionDto;

    if (!name) {
      throw new BadRequestException('Option name is required');
    }

    const validOptionTypes = ['radio', 'checkbox', 'dropdown', 'text'];
    const finalOptionType = option_type && validOptionTypes.includes(option_type) ? option_type : 'dropdown';

    return this.dataSource.transaction(async (manager) => {
      const result = await manager.query(`INSERT INTO options (name, option_type) VALUES ($1, $2) RETURNING *`, [name, finalOptionType]);
      const newOption = result[0];

      if (values && Array.isArray(values) && values.length > 0) {
        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          await manager.query(
            `INSERT INTO option_value (option_id, name, sort_order, standard_price, wholesale_price) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
              newOption.option_id,
              value.name,
              value.sort_order || i + 1,
              value.standard_price || 0,
              value.wholesale_price || (value.standard_price || 0) * 0.9,
            ]
          );
        }
      }

      const completeOption = await manager.query(
        `SELECT 
          o.*,
          (
            SELECT json_agg(
              json_build_object(
                'option_value_id', ov.option_value_id,
                'name', ov.name,
                'sort_order', ov.sort_order,
                'standard_price', ov.standard_price,
                'wholesale_price', ov.wholesale_price
              ) ORDER BY ov.sort_order
            )
            FROM option_value ov
            WHERE ov.option_id = o.option_id
          ) as values
        FROM options o
        WHERE o.option_id = $1`,
        [newOption.option_id],
      );

      return { option: completeOption[0], message: 'Option created successfully' };
    });
  }

  async update(id: number, updateOptionDto: any): Promise<any> {
    const { name, option_type, values } = updateOptionDto;

    return this.dataSource.transaction(async (manager) => {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        params.push(name);
      }
      if (option_type !== undefined) {
        const validOptionTypes = ['radio', 'checkbox', 'dropdown', 'text'];
        if (validOptionTypes.includes(option_type)) {
          updates.push(`option_type = $${paramIndex++}`);
          params.push(option_type);
        }
      }

      if (updates.length > 0) {
        params.push(id);
        const result = await manager.query(
          `UPDATE options SET ${updates.join(', ')} WHERE option_id = $${paramIndex} RETURNING *`,
          params,
        );
        if (result.length === 0) {
          throw new NotFoundException('Option not found');
        }
      } else {
        const result = await manager.query(`SELECT * FROM options WHERE option_id = $1`, [id]);
        if (result.length === 0) {
          throw new NotFoundException('Option not found');
        }
      }

      if (values && Array.isArray(values)) {
        await manager.query('DELETE FROM option_value WHERE option_id = $1', [id]);

        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          await manager.query(
            `INSERT INTO option_value (option_id, name, sort_order, standard_price, wholesale_price) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
              id,
              value.name,
              value.sort_order || i + 1,
              value.standard_price || 0,
              value.wholesale_price || (value.standard_price || 0) * 0.9,
            ]
          );
        }
      }

      const completeOption = await manager.query(
        `SELECT 
          o.*,
          (
            SELECT json_agg(
              json_build_object(
                'option_value_id', ov.option_value_id,
                'name', ov.name,
                'sort_order', ov.sort_order,
                'standard_price', ov.standard_price,
                'wholesale_price', ov.wholesale_price
              ) ORDER BY ov.sort_order
            )
            FROM option_value ov
            WHERE ov.option_id = o.option_id
          ) as values
        FROM options o
        WHERE o.option_id = $1`,
        [id],
      );

      return { option: completeOption[0], message: 'Option updated successfully' };
    });
  }

  async delete(id: number): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM option_value WHERE option_id = $1', [id]);
      const result = await manager.query('DELETE FROM options WHERE option_id = $1 RETURNING *', [id]);

      if (result.length === 0) {
        throw new NotFoundException('Option not found');
      }
    });
  }
}
