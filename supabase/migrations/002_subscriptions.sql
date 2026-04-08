-- =============================================================================
-- Varda — Subscription & Tier System
-- =============================================================================

-- Subscription plans
CREATE TYPE subscription_plan AS ENUM ('trial', 'starter', 'pro', 'business');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired');

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE UNIQUE NOT NULL,
  plan subscription_plan NOT NULL DEFAULT 'trial',
  status subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at timestamptz DEFAULT now() + interval '14 days',
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Index
CREATE INDEX idx_subscriptions_org_id ON subscriptions (org_id);

-- Auto-create trial subscription when org is created
CREATE OR REPLACE FUNCTION handle_new_org_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO subscriptions (org_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'trialing', now() + interval '14 days')
  ON CONFLICT (org_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_org_created_subscription
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION handle_new_org_subscription();

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org subscription"
  ON subscriptions FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "Owners can update subscription"
  ON subscriptions FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- Feature limits per plan (reference table, no RLS needed — public read)
CREATE TABLE plan_features (
  plan subscription_plan PRIMARY KEY,
  max_users int NOT NULL DEFAULT 1,
  max_active_jobs int, -- NULL = unlimited
  max_customers int,   -- NULL = unlimited
  multi_line_quotes boolean NOT NULL DEFAULT false,
  invoicing boolean NOT NULL DEFAULT false,
  expenses boolean NOT NULL DEFAULT false,
  insights_basic boolean NOT NULL DEFAULT false,
  insights_advanced boolean NOT NULL DEFAULT false,
  communications boolean NOT NULL DEFAULT false,
  team_management boolean NOT NULL DEFAULT false,
  csv_export boolean NOT NULL DEFAULT false,
  pdf_invoices boolean NOT NULL DEFAULT false,
  customer_quote_page boolean NOT NULL DEFAULT false,
  pricing_rules boolean NOT NULL DEFAULT false,
  calendar_full boolean NOT NULL DEFAULT false
);

-- Seed feature matrix
INSERT INTO plan_features (plan, max_users, max_active_jobs, max_customers, multi_line_quotes, invoicing, expenses, insights_basic, insights_advanced, communications, team_management, csv_export, pdf_invoices, customer_quote_page, pricing_rules, calendar_full) VALUES
  ('trial',    99, NULL, NULL, true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true),   -- Trial = full Pro access
  ('starter',  1,  20,   50,   false, false, false, false, false, false, false, false, true,  false, false, false),
  ('pro',      3,  NULL, NULL, true,  true,  true,  true,  false, true,  false, false, true,  true,  true,  true),
  ('business', 999, NULL, NULL, true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true);

-- Allow anyone authenticated to read plan_features
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read plan features" ON plan_features FOR SELECT USING (true);

-- Create trial for existing demo org (if seed was run)
INSERT INTO subscriptions (org_id, plan, status, trial_ends_at)
SELECT id, 'trial', 'trialing', now() + interval '14 days'
FROM organizations
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE subscriptions.org_id = organizations.id);
