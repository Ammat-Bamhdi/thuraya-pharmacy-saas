/**
 * User and Authentication Models
 */

export type Role = 'super_admin' | 'branch_admin' | 'section_admin';

export type UserStatus = 'active' | 'invited' | 'suspended';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId?: string;
  sectionId?: string;
  status: UserStatus;
  avatar?: string;
}
