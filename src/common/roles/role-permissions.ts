/**
 * Role-Based Access Control (RBAC) Configuration
 * Defines what each role can see and do in the user management system
 */

export enum AuthLevel {
  SUPER_ADMIN = 1,
  ADMIN = 2,
  MANAGER = 3,
}

export interface RolePermissions {
  // User Management Permissions
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  
  // Data Visibility
  canViewAllUsers: boolean; // Can see users of all roles
  canViewSameOrLowerLevel: boolean; // Can see users with same or lower auth_level
  canViewOnlyLowerLevel: boolean; // Can only see users with lower auth_level
  
  // Role Management
  canAssignRoles: number[]; // Array of auth_levels this role can assign
  canEditOwnRole: boolean; // Can edit their own role
  
  // User Fields Visibility
  canViewEmail: boolean;
  canViewCompanyName: boolean;
  canViewAccountEmail: boolean;
  canViewCreatedAt: boolean;
  
  // User Fields Editable
  canEditEmail: boolean;
  canEditPassword: boolean;
  canEditRole: boolean;
  canEditCompanyName: boolean;
  canEditAccountEmail: boolean;
}

export const ROLE_PERMISSIONS: Record<AuthLevel, RolePermissions> = {
  [AuthLevel.SUPER_ADMIN]: {
    // Can do everything
    canViewUsers: true,
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canViewAllUsers: true,
    canViewSameOrLowerLevel: false,
    canViewOnlyLowerLevel: false,
    canAssignRoles: [1, 2, 3], // Can assign all roles
    canEditOwnRole: true,
    canViewEmail: true,
    canViewCompanyName: true,
    canViewAccountEmail: true,
    canViewCreatedAt: true,
    canEditEmail: true,
    canEditPassword: true,
    canEditRole: true,
    canEditCompanyName: true,
    canEditAccountEmail: true,
  },
  [AuthLevel.ADMIN]: {
    // Can manage Admin and Manager users, but not Super Admin
    canViewUsers: true,
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    canViewAllUsers: false,
    canViewSameOrLowerLevel: true, // Can see Admin (2) and Manager (3)
    canViewOnlyLowerLevel: false,
    canAssignRoles: [2, 3], // Can assign Admin and Manager roles
    canEditOwnRole: false,
    canViewEmail: true,
    canViewCompanyName: true,
    canViewAccountEmail: true,
    canViewCreatedAt: true,
    canEditEmail: true,
    canEditPassword: true,
    canEditRole: true, // But only to assign roles 2 or 3
    canEditCompanyName: true,
    canEditAccountEmail: true,
  },
  [AuthLevel.MANAGER]: {
    // Limited access - can only view, cannot create/edit/delete
    canViewUsers: true,
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    canViewAllUsers: false,
    canViewSameOrLowerLevel: false,
    canViewOnlyLowerLevel: true, // Can only see users with auth_level > 3 (customers)
    canAssignRoles: [], // Cannot assign any roles
    canEditOwnRole: false,
    canViewEmail: true,
    canViewCompanyName: true,
    canViewAccountEmail: false, // Cannot view account email
    canViewCreatedAt: true,
    canEditEmail: false,
    canEditPassword: false,
    canEditRole: false,
    canEditCompanyName: false,
    canEditAccountEmail: false,
  },
};

/**
 * Get permissions for a specific role
 */
export function getRolePermissions(authLevel: number): RolePermissions {
  return ROLE_PERMISSIONS[authLevel as AuthLevel] || ROLE_PERMISSIONS[AuthLevel.MANAGER];
}

/**
 * Check if a role can view users with a specific auth_level
 */
export function canViewUser(viewerLevel: number, targetUserLevel: number): boolean {
  const permissions = getRolePermissions(viewerLevel);
  
  if (permissions.canViewAllUsers) {
    return true;
  }
  
  if (permissions.canViewSameOrLowerLevel) {
    return targetUserLevel >= viewerLevel;
  }
  
  if (permissions.canViewOnlyLowerLevel) {
    return targetUserLevel > viewerLevel;
  }
  
  return false;
}

/**
 * Check if a role can assign a specific auth_level
 */
export function canAssignRole(assignerLevel: number, targetRole: number): boolean {
  const permissions = getRolePermissions(assignerLevel);
  return permissions.canAssignRoles.includes(targetRole);
}

