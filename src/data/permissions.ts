/**
 * Granular permissions system for team management.
 *
 * Each permission is a dot-separated key like 'quotes.create' or
 * 'invoices.void'. The default matrix defines what each role can do
 * out of the box. Organisation owners can override individual
 * permissions per role via the org_permissions table.
 *
 * The owner role ALWAYS has all permissions — overrides are ignored.
 */

export type Permission =
  // Jobs
  | 'jobs.view'           // See jobs (filtered to assigned if member)
  | 'jobs.viewAll'        // See ALL jobs (not just assigned)
  | 'jobs.create'         // Create new jobs
  | 'jobs.edit'           // Edit job details
  | 'jobs.delete'         // Soft-delete jobs
  | 'jobs.assign'         // Assign jobs to team members
  | 'jobs.changeStatus'   // Move jobs through the pipeline
  // Quotes
  | 'quotes.view'
  | 'quotes.create'
  | 'quotes.edit'
  | 'quotes.send'         // Send quotes to customers
  // Invoices
  | 'invoices.view'
  | 'invoices.create'
  | 'invoices.send'
  | 'invoices.markPaid'
  | 'invoices.void'
  | 'invoices.delete'
  // Customers
  | 'customers.view'
  | 'customers.create'
  | 'customers.edit'
  | 'customers.delete'
  // Calendar / Schedule
  | 'calendar.view'
  | 'calendar.viewAll'    // See all team members' events
  | 'calendar.create'
  | 'calendar.edit'
  | 'calendar.sendConfirmation'
  // Expenses
  | 'expenses.view'
  | 'expenses.create'
  | 'expenses.edit'
  | 'expenses.delete'
  // Insights / Reports
  | 'insights.view'
  | 'insights.export'
  // Settings
  | 'settings.view'
  | 'settings.edit'
  // Team management
  | 'team.view'
  | 'team.invite'
  | 'team.changeRoles'
  | 'team.remove'

export type Role = 'owner' | 'admin' | 'member'

/**
 * Default permission matrix. Owner always gets everything (enforced
 * at check time, not listed here). Admin and Member defaults below.
 */
const DEFAULT_PERMISSIONS: Record<Exclude<Role, 'owner'>, Permission[]> = {
  admin: [
    // Jobs — full access
    'jobs.view', 'jobs.viewAll', 'jobs.create', 'jobs.edit', 'jobs.delete',
    'jobs.assign', 'jobs.changeStatus',
    // Quotes
    'quotes.view', 'quotes.create', 'quotes.edit', 'quotes.send',
    // Invoices
    'invoices.view', 'invoices.create', 'invoices.send', 'invoices.markPaid',
    'invoices.void', 'invoices.delete',
    // Customers
    'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
    // Calendar
    'calendar.view', 'calendar.viewAll', 'calendar.create', 'calendar.edit',
    'calendar.sendConfirmation',
    // Expenses
    'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete',
    // Insights
    'insights.view', 'insights.export',
    // Settings — view only (edit is owner-only by default)
    'settings.view',
    // Team — view only
    'team.view',
  ],
  member: [
    // Jobs — own jobs only, can change status
    'jobs.view', 'jobs.create', 'jobs.changeStatus',
    // Quotes — view and create
    'quotes.view', 'quotes.create',
    // Invoices — view only
    'invoices.view',
    // Customers — view and create
    'customers.view', 'customers.create',
    // Calendar — own events only
    'calendar.view', 'calendar.create', 'calendar.edit',
    // No expenses, insights, settings, or team management
  ],
}

/**
 * All available permissions grouped by category for the settings UI.
 */
export const PERMISSION_GROUPS: { label: string; permissions: { key: Permission; label: string }[] }[] = [
  {
    label: 'Jobs',
    permissions: [
      { key: 'jobs.view', label: 'View assigned jobs' },
      { key: 'jobs.viewAll', label: 'View all jobs' },
      { key: 'jobs.create', label: 'Create jobs' },
      { key: 'jobs.edit', label: 'Edit job details' },
      { key: 'jobs.delete', label: 'Delete jobs' },
      { key: 'jobs.assign', label: 'Assign jobs to team members' },
      { key: 'jobs.changeStatus', label: 'Change job status' },
    ],
  },
  {
    label: 'Quotes',
    permissions: [
      { key: 'quotes.view', label: 'View quotes' },
      { key: 'quotes.create', label: 'Create quotes' },
      { key: 'quotes.edit', label: 'Edit quotes' },
      { key: 'quotes.send', label: 'Send quotes to customers' },
    ],
  },
  {
    label: 'Invoices',
    permissions: [
      { key: 'invoices.view', label: 'View invoices' },
      { key: 'invoices.create', label: 'Create invoices' },
      { key: 'invoices.send', label: 'Send invoices' },
      { key: 'invoices.markPaid', label: 'Mark invoices as paid' },
      { key: 'invoices.void', label: 'Void invoices' },
      { key: 'invoices.delete', label: 'Delete invoices' },
    ],
  },
  {
    label: 'Customers',
    permissions: [
      { key: 'customers.view', label: 'View customers' },
      { key: 'customers.create', label: 'Create customers' },
      { key: 'customers.edit', label: 'Edit customers' },
      { key: 'customers.delete', label: 'Delete customers' },
    ],
  },
  {
    label: 'Calendar',
    permissions: [
      { key: 'calendar.view', label: 'View own schedule' },
      { key: 'calendar.viewAll', label: 'View all team schedules' },
      { key: 'calendar.create', label: 'Create events' },
      { key: 'calendar.edit', label: 'Edit events' },
      { key: 'calendar.sendConfirmation', label: 'Send booking confirmations' },
    ],
  },
  {
    label: 'Expenses',
    permissions: [
      { key: 'expenses.view', label: 'View expenses' },
      { key: 'expenses.create', label: 'Log expenses' },
      { key: 'expenses.edit', label: 'Edit expenses' },
      { key: 'expenses.delete', label: 'Delete expenses' },
    ],
  },
  {
    label: 'Insights & Reports',
    permissions: [
      { key: 'insights.view', label: 'View insights' },
      { key: 'insights.export', label: 'Export data' },
    ],
  },
  {
    label: 'Settings & Team',
    permissions: [
      { key: 'settings.view', label: 'View organisation settings' },
      { key: 'settings.edit', label: 'Edit organisation settings' },
      { key: 'team.view', label: 'View team members' },
      { key: 'team.invite', label: 'Invite team members' },
      { key: 'team.changeRoles', label: 'Change member roles' },
      { key: 'team.remove', label: 'Remove team members' },
    ],
  },
]

/**
 * Check whether a role has a specific permission.
 *
 * @param role - The user's role
 * @param permission - The permission to check
 * @param overrides - Per-org overrides from the org_permissions table.
 *   Map of `permission → allowed` that takes precedence over defaults.
 * @returns true if the permission is granted
 */
export function hasPermission(
  role: Role,
  permission: Permission,
  overrides?: Record<string, boolean>,
): boolean {
  // Owner always has everything — non-negotiable
  if (role === 'owner') return true

  // Check overrides first (org-specific customisation)
  if (overrides && permission in overrides) {
    return overrides[permission]
  }

  // Fall back to defaults
  const defaults = DEFAULT_PERMISSIONS[role]
  return defaults?.includes(permission) ?? false
}

/**
 * Get the full resolved permission set for a role, including overrides.
 * Used by the settings UI to render the permission matrix.
 */
export function getResolvedPermissions(
  role: Role,
  overrides?: Record<string, boolean>,
): Record<Permission, boolean> {
  const result: Record<string, boolean> = {}
  for (const group of PERMISSION_GROUPS) {
    for (const p of group.permissions) {
      result[p.key] = hasPermission(role, p.key, overrides)
    }
  }
  return result as Record<Permission, boolean>
}
