/**
 * Activity logging — fires-and-forgets an insert into the activity_log
 * table so there's a trail of who did what. All calls are best-effort
 * (errors are swallowed) so they never block the UI.
 */

import { supabase } from './supabase'

export type ActivityAction =
  | 'job.created' | 'job.updated' | 'job.statusChanged' | 'job.deleted' | 'job.assigned'
  | 'quote.created' | 'quote.sent' | 'quote.updated'
  | 'invoice.created' | 'invoice.sent' | 'invoice.paid' | 'invoice.voided' | 'invoice.deleted'
  | 'customer.created' | 'customer.updated' | 'customer.deleted'
  | 'event.created' | 'event.updated' | 'event.deleted'
  | 'schedule.confirmed' | 'schedule.resent'
  | 'settings.updated'

export function logActivity(params: {
  orgId: string
  userId: string
  userName: string
  action: ActivityAction
  entityType?: string
  entityId?: string
  details?: Record<string, unknown>
}) {
  // Fire-and-forget — never block the UI
  supabase.from('activity_log').insert({
    org_id: params.orgId,
    user_id: params.userId,
    user_name: params.userName,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    details: params.details ?? null,
  }).then(() => {}, () => {})
}
