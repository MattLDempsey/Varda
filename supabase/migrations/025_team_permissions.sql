-- ═══════════════════════════════════════════════════════════════════
-- Team permissions + job assignment
-- ═══════════════════════════════════════════════════════════════════
-- Adds:
--   1. Job assignment (assigned_to FK on jobs)
--   2. Granular permissions (org_permissions table)
--   3. Activity log (activity_log table)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Job assignment — which team member is responsible for this job
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON jobs(assigned_to);

-- 2. Granular permissions per role per org
-- Each row grants a specific permission to a specific role within an org.
-- If no rows exist for an org, the system falls back to hardcoded defaults.
CREATE TABLE IF NOT EXISTS org_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role        user_role NOT NULL,
  permission  text NOT NULL,      -- e.g. 'quotes.create', 'invoices.void', 'jobs.delete'
  allowed     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, role, permission)
);

CREATE INDEX IF NOT EXISTS idx_org_permissions_org_role ON org_permissions(org_id, role);

ALTER TABLE org_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org isolation: select org_permissions"
  ON org_permissions FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Org isolation: insert org_permissions"
  ON org_permissions FOR INSERT
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "Org isolation: update org_permissions"
  ON org_permissions FOR UPDATE
  USING (org_id = auth_org_id());

CREATE POLICY "Org isolation: delete org_permissions"
  ON org_permissions FOR DELETE
  USING (org_id = auth_org_id());

-- 3. Activity log — who did what, when
CREATE TABLE IF NOT EXISTS activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  user_name   text,
  action      text NOT NULL,      -- e.g. 'job.created', 'invoice.voided', 'quote.sent'
  entity_type text,               -- 'job', 'quote', 'invoice', 'customer', 'event'
  entity_id   text,               -- the ID of the affected row
  details     jsonb,              -- optional extra context
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_org ON activity_log(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org isolation: select activity_log"
  ON activity_log FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Org isolation: insert activity_log"
  ON activity_log FOR INSERT
  WITH CHECK (org_id = auth_org_id());
