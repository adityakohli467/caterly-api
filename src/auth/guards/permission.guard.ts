import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

export const PERMISSION_KEY = 'permission';

/**
 * Decorator to require a specific permission
 * Usage: @RequirePermission('users.create')
 */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Get required permission from metadata
    const requiredPermission = this.reflector.get<string>(
      PERMISSION_KEY,
      context.getHandler(),
    );

    // If no permission required, allow access (fallback to other guards)
    if (!requiredPermission) {
      return true;
    }

    // Check if user has the required permission
    const hasPermission = await this.checkUserPermission(user.user_id, requiredPermission);

    if (!hasPermission) {
      throw new ForbiddenException(
        `Permission denied. Required permission: ${requiredPermission}`,
      );
    }

    return true;
  }

  /**
   * Check if user has a specific permission through their roles
   */
  private async checkUserPermission(userId: number, permissionKey: string): Promise<boolean> {
    try {
      // First check if user has permission through roles
      const rolePermissionResult = await this.dataSource.query(
        `SELECT COUNT(*) as count
         FROM user_roles ur
         INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
         INNER JOIN permissions p ON rp.permission_id = p.permission_id
         WHERE ur.user_id = $1 AND p.permission_key = $2 AND rp.granted = TRUE`,
        [userId, permissionKey],
      );

      if (parseInt(rolePermissionResult[0].count) > 0) {
        return true;
      }

      // Fallback: Check auth_level based permissions for backward compatibility
      // This allows the system to work with both permission systems
      const userResult = await this.dataSource.query(
        `SELECT auth_level FROM "user" WHERE user_id = $1`,
        [userId],
      );

      if (userResult.length === 0) {
        return false;
      }

      const authLevel = userResult[0].auth_level;

      // Super Admin (auth_level 1) has all permissions
      if (authLevel === 1) {
        return true;
      }

      // Admin (auth_level 2) has most permissions except super admin only ones
      if (authLevel === 2) {
        // Block super admin only permissions
        const superAdminOnlyPermissions = [
          'roles.create',
          'roles.delete',
          'users.create.super_admin',
          'users.edit.super_admin',
          'users.delete.super_admin',
        ];
        if (superAdminOnlyPermissions.includes(permissionKey)) {
          return false;
        }
        return true;
      }

      // Manager (auth_level 3) has limited permissions
      if (authLevel === 3) {
        const managerPermissions = [
          'users.view',
          'customers.view',
          'orders.view',
          'quotes.view',
        ];
        return managerPermissions.includes(permissionKey);
      }

      return false;
    } catch (error) {
      console.error('Error checking user permission:', error);
      return false;
    }
  }
}

