import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../../entities/Role';
import { Permission } from '../../entities/Permission';

@Injectable()
export class AdminRolesService {
  private readonly logger = new Logger(AdminRolesService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Get all roles
   */
  async findAll(query: any): Promise<any> {
    const { limit = 100, offset = 0, search } = query;

    let sqlQuery = `
      SELECT 
        r.role_id,
        r.role_name,
        r.role_description,
        r.is_system_role,
        r.created_at,
        r.updated_at,
        COUNT(DISTINCT ur.user_id) as user_count,
        COUNT(DISTINCT rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.role_id = ur.role_id
      LEFT JOIN role_permissions rp ON r.role_id = rp.role_id AND rp.granted = TRUE
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      sqlQuery += ` AND (r.role_name ILIKE $${paramIndex} OR r.role_description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sqlQuery += ` GROUP BY r.role_id ORDER BY r.role_name ASC`;
    sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(sqlQuery, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM roles WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND (role_name ILIKE $${countParamIndex} OR role_description ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return {
      roles: result.map((row: any) => ({
        role_id: row.role_id,
        role_name: row.role_name,
        role_description: row.role_description,
        is_system_role: row.is_system_role,
        user_count: parseInt(row.user_count) || 0,
        permission_count: parseInt(row.permission_count) || 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
      count,
      limit: Number(limit),
      offset: Number(offset),
    };
  }

  /**
   * Get role by ID with permissions
   */
  async findOne(id: number): Promise<any> {
    const roleResult = await this.dataSource.query(
      `SELECT * FROM roles WHERE role_id = $1`,
      [id],
    );

    if (roleResult.length === 0) {
      throw new NotFoundException('Role not found');
    }

    const role = roleResult[0];

    // Get permissions for this role
    const permissionsResult = await this.dataSource.query(
      `SELECT 
        p.permission_id,
        p.permission_key,
        p.permission_name,
        p.permission_description,
        p.permission_category,
        rp.granted
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.permission_id = rp.permission_id AND rp.role_id = $1
      ORDER BY p.permission_category, p.permission_name`,
      [id],
    );

    return {
      role: {
        role_id: role.role_id,
        role_name: role.role_name,
        role_description: role.role_description,
        is_system_role: role.is_system_role,
        created_at: role.created_at,
        updated_at: role.updated_at,
      },
      permissions: permissionsResult.map((p: any) => ({
        permission_id: p.permission_id,
        permission_key: p.permission_key,
        permission_name: p.permission_name,
        permission_description: p.permission_description,
        permission_category: p.permission_category,
        granted: p.granted === true || p.granted === 'true',
      })),
    };
  }

  /**
   * Create a new role
   */
  async create(createRoleDto: any, currentUserLevel?: number): Promise<any> {
    const { role_name, role_description, permissions } = createRoleDto;

    if (!role_name || role_name.trim() === '') {
      throw new BadRequestException('Role name is required');
    }

    // Check if role already exists
    const existingRole = await this.dataSource.query(
      'SELECT role_id FROM roles WHERE role_name = $1',
      [role_name.trim()],
    );

    if (existingRole.length > 0) {
      throw new BadRequestException('Role with this name already exists');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create role
      const roleResult = await queryRunner.query(
        `INSERT INTO roles (role_name, role_description, is_system_role)
         VALUES ($1, $2, FALSE)
         RETURNING *`,
        [role_name.trim(), role_description?.trim() || null],
      );

      const role = roleResult[0];

      // Assign permissions if provided
      if (permissions && Array.isArray(permissions)) {
        for (const perm of permissions) {
          if (perm.permission_id && perm.granted) {
            await queryRunner.query(
              `INSERT INTO role_permissions (role_id, permission_id, granted)
               VALUES ($1, $2, TRUE)
               ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = TRUE`,
              [role.role_id, perm.permission_id],
            );
          }
        }
      }

      await queryRunner.commitTransaction();

      return {
        role: {
          role_id: role.role_id,
          role_name: role.role_name,
          role_description: role.role_description,
          is_system_role: role.is_system_role,
        },
        message: 'Role created successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Create role error:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update a role
   */
  async update(id: number, updateRoleDto: any, currentUserLevel?: number): Promise<any> {
    const { role_name, role_description, permissions } = updateRoleDto;

    const existingRole = await this.dataSource.query(
      'SELECT * FROM roles WHERE role_id = $1',
      [id],
    );

    if (existingRole.length === 0) {
      throw new NotFoundException('Role not found');
    }

    const role = existingRole[0];

    // Prevent editing system roles (optional - can be removed if you want to allow editing)
    if (role.is_system_role && role_name && role_name !== role.role_name) {
      throw new ForbiddenException('Cannot rename system roles');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (role_name && role_name !== role.role_name) {
        // Check if new name already exists
        const nameCheck = await queryRunner.query(
          'SELECT role_id FROM roles WHERE role_name = $1 AND role_id != $2',
          [role_name.trim(), id],
        );
        if (nameCheck.length > 0) {
          throw new BadRequestException('Role with this name already exists');
        }
        updates.push(`role_name = $${paramIndex++}`);
        params.push(role_name.trim());
      }

      if (role_description !== undefined) {
        updates.push(`role_description = $${paramIndex++}`);
        params.push(role_description?.trim() || null);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);
        await queryRunner.query(
          `UPDATE roles SET ${updates.join(', ')} WHERE role_id = $${paramIndex}`,
          params,
        );
      }

      // Update permissions if provided
      if (permissions && Array.isArray(permissions)) {
        // Delete all existing permissions for this role
        await queryRunner.query(
          'DELETE FROM role_permissions WHERE role_id = $1',
          [id],
        );

        // Insert new permissions
        for (const perm of permissions) {
          if (perm.permission_id && perm.granted) {
            await queryRunner.query(
              `INSERT INTO role_permissions (role_id, permission_id, granted)
               VALUES ($1, $2, TRUE)`,
              [id, perm.permission_id],
            );
          }
        }
      }

      await queryRunner.commitTransaction();

      return {
        message: 'Role updated successfully',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Update role error:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Delete a role
   */
  async delete(id: number): Promise<void> {
    const role = await this.dataSource.query(
      'SELECT * FROM roles WHERE role_id = $1',
      [id],
    );

    if (role.length === 0) {
      throw new NotFoundException('Role not found');
    }

    if (role[0].is_system_role) {
      throw new ForbiddenException('Cannot delete system roles');
    }

    // Check if role is assigned to any users
    const userCount = await this.dataSource.query(
      'SELECT COUNT(*) as count FROM user_roles WHERE role_id = $1',
      [id],
    );

    if (parseInt(userCount[0].count) > 0) {
      throw new BadRequestException('Cannot delete role that is assigned to users. Please reassign users first.');
    }

    await this.dataSource.query('DELETE FROM roles WHERE role_id = $1', [id]);
  }

  /**
   * Get all permissions grouped by category
   */
  async getAllPermissions(): Promise<any> {
    const result = await this.dataSource.query(
      `SELECT 
        permission_id,
        permission_key,
        permission_name,
        permission_description,
        permission_category
      FROM permissions
      ORDER BY permission_category, permission_name`,
    );

    // Group by category
    const grouped: Record<string, any[]> = {};
    result.forEach((perm: any) => {
      if (!grouped[perm.permission_category]) {
        grouped[perm.permission_category] = [];
      }
      grouped[perm.permission_category].push({
        permission_id: perm.permission_id,
        permission_key: perm.permission_key,
        permission_name: perm.permission_name,
        permission_description: perm.permission_description,
        permission_category: perm.permission_category,
      });
    });

    return {
      permissions: result,
      grouped,
    };
  }

  /**
   * Check if user has a specific permission
   */
  async userHasPermission(userId: number, permissionKey: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT COUNT(*) as count
       FROM user_roles ur
       INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
       INNER JOIN permissions p ON rp.permission_id = p.permission_id
       WHERE ur.user_id = $1 AND p.permission_key = $2 AND rp.granted = TRUE`,
      [userId, permissionKey],
    );

    return parseInt(result[0].count) > 0;
  }

  /**
   * Get user's permissions
   */
  async getUserPermissions(userId: number): Promise<string[]> {
    const result = await this.dataSource.query(
      `SELECT DISTINCT p.permission_key
       FROM user_roles ur
       INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
       INNER JOIN permissions p ON rp.permission_id = p.permission_id
       WHERE ur.user_id = $1 AND rp.granted = TRUE`,
      [userId],
    );

    return result.map((row: any) => row.permission_key);
  }
}

