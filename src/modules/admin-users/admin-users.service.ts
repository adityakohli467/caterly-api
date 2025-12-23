import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { getRolePermissions, canViewUser, canAssignRole, AuthLevel } from '../../common/roles/role-permissions';

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private dataSource: DataSource) {}

  async findAll(query: any, currentUserLevel?: number): Promise<any> {
    const { limit = 20, offset = 0, search } = query;

    let sqlQuery = `
      SELECT 
        u.user_id, 
        u.email, 
        u.username, 
        u.auth_level,
        u.role_id,
        u.company_name,
        u.account_email,
        u.created_at,
        u.updated_at,
        r.role_id as role_role_id,
        r.role_name,
        r.role_description
      FROM "user" u
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Apply role-based filtering
    if (currentUserLevel !== undefined) {
      const permissions = getRolePermissions(currentUserLevel);
      
      if (!permissions.canViewAllUsers) {
        if (permissions.canViewSameOrLowerLevel) {
          // Can view users with same or lower level (Admin can see Admin and Manager)
          sqlQuery += ` AND auth_level >= $${paramIndex}`;
          params.push(currentUserLevel);
          paramIndex++;
        } else if (permissions.canViewOnlyLowerLevel) {
          // Can only view users with lower level (Manager can see customers)
          sqlQuery += ` AND auth_level > $${paramIndex}`;
          params.push(currentUserLevel);
          paramIndex++;
        }
      }
    }

    if (search) {
      sqlQuery += ` AND (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR company_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sqlQuery += ' ORDER BY user_id DESC';
    sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), Number(offset));

    const result = await this.dataSource.query(sqlQuery, params);
    
    // Filter results based on permissions and remove sensitive fields
    const permissions = currentUserLevel !== undefined ? getRolePermissions(currentUserLevel) : getRolePermissions(AuthLevel.SUPER_ADMIN);
    const filteredResult = result
      .filter((user: any) => {
        // Additional filtering in case SQL filter wasn't enough
        if (currentUserLevel === undefined) return true;
        return canViewUser(currentUserLevel, user.auth_level);
      })
      .map((user: any) => {
        const filteredUser: any = {
          user_id: user.user_id,
          username: user.username,
          auth_level: user.auth_level,
          role_id: user.role_id,
        };
        
        // Add role information if available
        if (user.role_name) {
          filteredUser.role = {
            role_id: user.role_role_id,
            role_name: user.role_name,
            role_description: user.role_description,
          };
        }
        
        // Add fields based on permissions
        if (permissions.canViewEmail) {
          filteredUser.email = user.email;
        }
        if (permissions.canViewCompanyName) {
          filteredUser.company_name = user.company_name;
        }
        if (permissions.canViewAccountEmail) {
          filteredUser.account_email = user.account_email;
        }
        if (permissions.canViewCreatedAt) {
          filteredUser.created_at = user.created_at;
          filteredUser.updated_at = user.updated_at;
        }
        
        return filteredUser;
      });

    let countQuery = 'SELECT COUNT(*) FROM "user" WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    // Apply same role-based filtering for count
    if (currentUserLevel !== undefined) {
      const permissions = getRolePermissions(currentUserLevel);
      
      if (!permissions.canViewAllUsers) {
        if (permissions.canViewSameOrLowerLevel) {
          countQuery += ` AND auth_level >= $${countParamIndex}`;
          countParams.push(currentUserLevel);
          countParamIndex++;
        } else if (permissions.canViewOnlyLowerLevel) {
          countQuery += ` AND auth_level > $${countParamIndex}`;
          countParams.push(currentUserLevel);
          countParamIndex++;
        }
      }
    }

    if (search) {
      countQuery += ` AND (username ILIKE $${countParamIndex} OR email ILIKE $${countParamIndex} OR company_name ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const count = parseInt(countResult[0].count);

    return { users: filteredResult, count, limit: Number(limit), offset: Number(offset) };
  }

  async findOne(id: number, currentUserLevel?: number): Promise<any> {
    const result = await this.dataSource.query(
      `SELECT 
        u.user_id, 
        u.email, 
        u.username, 
        u.auth_level,
        u.role_id,
        u.company_name,
        u.account_email,
        u.created_at,
        u.updated_at,
        r.role_id as role_role_id,
        r.role_name,
        r.role_description
      FROM "user" u
      LEFT JOIN roles r ON u.role_id = r.role_id
      WHERE u.user_id = $1`,
      [id],
    );

    if (result.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = result[0];
    
    // Check if current user can view this user
    if (currentUserLevel !== undefined && !canViewUser(currentUserLevel, user.auth_level)) {
      throw new ForbiddenException('You do not have permission to view this user');
    }

    // Filter fields based on permissions
    const permissions = currentUserLevel !== undefined ? getRolePermissions(currentUserLevel) : getRolePermissions(AuthLevel.SUPER_ADMIN);
    const filteredUser: any = {
      user_id: user.user_id,
      username: user.username,
      auth_level: user.auth_level,
      role_id: user.role_id,
    };
    
    // Add role information if available
    if (user.role_name) {
      filteredUser.role = {
        role_id: user.role_role_id,
        role_name: user.role_name,
        role_description: user.role_description,
      };
    }
    
    if (permissions.canViewEmail) {
      filteredUser.email = user.email;
    }
    if (permissions.canViewCompanyName) {
      filteredUser.company_name = user.company_name;
    }
    if (permissions.canViewAccountEmail) {
      filteredUser.account_email = user.account_email;
    }
    if (permissions.canViewCreatedAt) {
      filteredUser.created_at = user.created_at;
      filteredUser.updated_at = user.updated_at;
    }

    return { user: filteredUser };
  }

  async create(createUserDto: any, currentUserLevel?: number): Promise<any> {
    const { username, email, password, auth_level, role_id, company_name, account_email } = createUserDto;

    if (!username || !email || !password) {
      throw new BadRequestException('Username, email, and password are required');
    }

    // Check permissions
    if (currentUserLevel !== undefined) {
      const permissions = getRolePermissions(currentUserLevel);
      
      if (!permissions.canCreateUsers) {
        throw new ForbiddenException('You do not have permission to create users');
      }
      
      // Check if user can assign the requested role
      const targetRole = auth_level || 3;
      if (!canAssignRole(currentUserLevel, targetRole)) {
        throw new ForbiddenException(`You do not have permission to assign role with auth_level ${targetRole}`);
      }
    }

    const existingUser = await this.dataSource.query('SELECT user_id FROM "user" WHERE email = $1 OR username = $2', [email, username]);

    if (existingUser.length > 0) {
      throw new BadRequestException('Email or username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine role_id - use provided role_id, or map auth_level to role_id, or default to Manager
    let finalRoleId = role_id;
    if (!finalRoleId && auth_level) {
      // Map auth_level to role_id (backward compatibility)
      const roleMapResult = await this.dataSource.query(
        `SELECT role_id FROM roles WHERE 
         (auth_level = 1 AND role_name = 'Super Admin') OR
         (auth_level = 2 AND role_name = 'Admin') OR
         (auth_level = 3 AND role_name = 'Manager')
         LIMIT 1`,
      );
      if (roleMapResult.length > 0) {
        finalRoleId = roleMapResult[0].role_id;
      }
    }
    if (!finalRoleId) {
      // Default to Manager role
      const defaultRole = await this.dataSource.query(
        `SELECT role_id FROM roles WHERE role_name = 'Manager' LIMIT 1`,
      );
      finalRoleId = defaultRole.length > 0 ? defaultRole[0].role_id : null;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await queryRunner.query(
        `INSERT INTO "user" (
          username, 
          email, 
          password, 
          auth_level,
          role_id,
          company_name,
          account_email,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        RETURNING user_id, username, email, auth_level, role_id, company_name, account_email, created_at`,
        [username, email, hashedPassword, auth_level || 3, finalRoleId, company_name, account_email],
      );

      const newUser = result[0];

      // Create user_roles entry
      if (finalRoleId) {
        await queryRunner.query(
          `INSERT INTO user_roles (user_id, role_id, is_primary)
           VALUES ($1, $2, TRUE)
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [newUser.user_id, finalRoleId],
        );
      }

      await queryRunner.commitTransaction();
      return { user: newUser, message: 'User created successfully' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: number, updateUserDto: any, currentUserLevel?: number): Promise<any> {
    const existingUserResult = await this.dataSource.query('SELECT user_id, auth_level FROM "user" WHERE user_id = $1', [id]);

    if (existingUserResult.length === 0) {
      throw new NotFoundException('User not found');
    }

    const existingUser = existingUserResult[0];

    // Check permissions
    if (currentUserLevel !== undefined) {
      const permissions = getRolePermissions(currentUserLevel);
      
      if (!permissions.canEditUsers) {
        throw new ForbiddenException('You do not have permission to edit users');
      }
      
      // Check if current user can view/edit this user
      if (!canViewUser(currentUserLevel, existingUser.auth_level)) {
        throw new ForbiddenException('You do not have permission to edit this user');
      }
    }

    const { username, email, password, auth_level, role_id, company_name, account_email } = updateUserDto;
    
    // Check role assignment permission
    if (auth_level !== undefined && currentUserLevel !== undefined) {
      if (!canAssignRole(currentUserLevel, auth_level)) {
        throw new ForbiddenException(`You do not have permission to assign role with auth_level ${auth_level}`);
      }
      
      // Prevent users from editing their own role
      const permissions = getRolePermissions(currentUserLevel);
      if (!permissions.canEditOwnRole) {
        // Get current user ID from context (would need to pass it)
        // For now, we'll check if trying to change to a higher level
        if (auth_level < existingUser.auth_level) {
          throw new ForbiddenException('You cannot assign a higher role than the current one');
        }
      }
    }

    // Apply field-level permissions
    const permissions = currentUserLevel !== undefined ? getRolePermissions(currentUserLevel) : getRolePermissions(AuthLevel.SUPER_ADMIN);
    
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (username) {
      updates.push(`username = $${paramIndex}`);
      params.push(username);
      paramIndex++;
    }
    if (email && permissions.canEditEmail) {
      updates.push(`email = $${paramIndex}`);
      params.push(email);
      paramIndex++;
    } else if (email && !permissions.canEditEmail) {
      throw new ForbiddenException('You do not have permission to edit email');
    }
    if (password && permissions.canEditPassword) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push(`password = $${paramIndex}`);
      params.push(hashedPassword);
      paramIndex++;
    } else if (password && !permissions.canEditPassword) {
      throw new ForbiddenException('You do not have permission to edit password');
    }
    if (auth_level !== undefined && permissions.canEditRole) {
      updates.push(`auth_level = $${paramIndex}`);
      params.push(Number(auth_level));
      paramIndex++;
    } else if (auth_level !== undefined && !permissions.canEditRole) {
      throw new ForbiddenException('You do not have permission to edit role');
    }
    if (role_id !== undefined && permissions.canEditRole) {
      updates.push(`role_id = $${paramIndex}`);
      params.push(role_id ? Number(role_id) : null);
      paramIndex++;
      
      // Update user_roles table
      if (role_id) {
        // Remove existing primary role
        await this.dataSource.query(
          'UPDATE user_roles SET is_primary = FALSE WHERE user_id = $1',
          [id],
        );
        // Add new primary role
        await this.dataSource.query(
          `INSERT INTO user_roles (user_id, role_id, is_primary)
           VALUES ($1, $2, TRUE)
           ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = TRUE`,
          [id, role_id],
        );
      }
    } else if (role_id !== undefined && !permissions.canEditRole) {
      throw new ForbiddenException('You do not have permission to edit role');
    }
    if (company_name !== undefined && permissions.canEditCompanyName) {
      updates.push(`company_name = $${paramIndex}`);
      params.push(company_name);
      paramIndex++;
    } else if (company_name !== undefined && !permissions.canEditCompanyName) {
      throw new ForbiddenException('You do not have permission to edit company name');
    }
    if (account_email !== undefined && permissions.canEditAccountEmail) {
      updates.push(`account_email = $${paramIndex}`);
      params.push(account_email);
      paramIndex++;
    } else if (account_email !== undefined && !permissions.canEditAccountEmail) {
      throw new ForbiddenException('You do not have permission to edit account email');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await this.dataSource.query(
      `UPDATE "user" 
       SET ${updates.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING user_id, username, email, auth_level, company_name, account_email, updated_at`,
      params,
    );

    return { user: result[0], message: 'User updated successfully' };
  }

  async delete(id: number, currentUserId?: number, currentUserLevel?: number): Promise<void> {
    if (currentUserId && currentUserId === id) {
      throw new BadRequestException('Cannot delete your own account');
    }

    // Check permissions
    if (currentUserLevel !== undefined) {
      const permissions = getRolePermissions(currentUserLevel);
      
      if (!permissions.canDeleteUsers) {
        throw new ForbiddenException('You do not have permission to delete users');
      }
      
      // Check if user can view/delete this user
      const targetUserResult = await this.dataSource.query('SELECT auth_level FROM "user" WHERE user_id = $1', [id]);
      if (targetUserResult.length === 0) {
        throw new NotFoundException('User not found');
      }
      
      if (!canViewUser(currentUserLevel, targetUserResult[0].auth_level)) {
        throw new ForbiddenException('You do not have permission to delete this user');
      }
    }

    const result = await this.dataSource.query('DELETE FROM "user" WHERE user_id = $1 RETURNING *', [id]);

    if (result.length === 0) {
      throw new NotFoundException('User not found');
    }
  }
}
