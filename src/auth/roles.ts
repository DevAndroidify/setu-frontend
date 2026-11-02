import type { Role } from './session';

export const ROLE_LABELS: Record<Role, string> = {
  operator: 'Operator',
  reviewer: 'Reviewer',
  approver: 'Approver',
  auditor: 'Auditor',
  admin: 'Administrator',
};

export const ALL_ROLES: Role[] = ['operator', 'reviewer', 'approver', 'auditor', 'admin'];

export type NavItem = {
  label: string;
  to: string;
  roles: Role[];
  /** Built in a later phase: listed, not linked. */
  phase?: string;
};

/**
 * The main menu. Each role sees what it can use, matching the backend's role guards; the
 * backend still decides, the menu only avoids offering what would be refused.
 */
export const NAV: NavItem[] = [
  { label: 'Home', to: '/', roles: ALL_ROLES },
  { label: 'Sources', to: '/sources', roles: ['operator', 'admin'] },
  { label: 'Runs', to: '/runs', roles: ['operator', 'approver', 'auditor', 'admin'] },
  { label: 'Approvals', to: '/approvals', roles: ['approver'] },
  { label: 'Reports', to: '/reports', roles: ['auditor'] },
  { label: 'Quarantine', to: '/quarantine', roles: ['operator', 'admin'] },
  { label: 'Duplicate review', to: '/matches', roles: ['reviewer'] },
  { label: 'Records', to: '/persons', roles: ALL_ROLES },
  { label: 'Audit trail', to: '/audit', roles: ['auditor', 'admin'] },
  { label: 'System status', to: '/status', roles: ALL_ROLES },
];

export const navFor = (role: Role): NavItem[] => NAV.filter((item) => item.roles.includes(role));
