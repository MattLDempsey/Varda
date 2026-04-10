-- ═══════════════════════════════════════════════════════════════════
-- Plan features — defines what each subscription tier unlocks.
-- Run AFTER updating the plan_features table schema to include
-- the new columns added in this session.
-- ═══════════════════════════════════════════════════════════════════

-- Add new columns to plan_features (if they don't exist yet)
ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS multi_invoice boolean DEFAULT false;
ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS smart_alerts boolean DEFAULT false;
ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS job_assignment boolean DEFAULT false;
ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS activity_log boolean DEFAULT false;
ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS custom_job_types boolean DEFAULT false;
ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS calendar_drag boolean DEFAULT false;

-- Upsert all three plans
INSERT INTO plan_features (
  plan, max_users, max_active_jobs, max_customers,
  multi_line_quotes, invoicing, multi_invoice,
  expenses, insights_basic, insights_advanced, smart_alerts,
  communications, team_management, job_assignment, activity_log,
  custom_job_types, csv_export, pdf_invoices,
  customer_quote_page, pricing_rules, calendar_full, calendar_drag
) VALUES
  -- Starter: solo tradesperson, core workflow
  ('starter', 1, NULL, NULL,
   false, true, false,
   false, false, false, false,
   false, false, false, false,
   false, false, true,
   true, false, false, false),

  -- Pro: growing business, full feature set
  ('pro', 3, NULL, NULL,
   true, true, true,
   true, true, false, true,
   true, false, false, false,
   false, false, true,
   true, true, true, true),

  -- Business: multi-employee, team management + advanced
  ('business', 999, NULL, NULL,
   true, true, true,
   true, true, true, true,
   true, true, true, true,
   true, true, true,
   true, true, true, true)

ON CONFLICT (plan) DO UPDATE SET
  max_users = EXCLUDED.max_users,
  max_active_jobs = EXCLUDED.max_active_jobs,
  max_customers = EXCLUDED.max_customers,
  multi_line_quotes = EXCLUDED.multi_line_quotes,
  invoicing = EXCLUDED.invoicing,
  multi_invoice = EXCLUDED.multi_invoice,
  expenses = EXCLUDED.expenses,
  insights_basic = EXCLUDED.insights_basic,
  insights_advanced = EXCLUDED.insights_advanced,
  smart_alerts = EXCLUDED.smart_alerts,
  communications = EXCLUDED.communications,
  team_management = EXCLUDED.team_management,
  job_assignment = EXCLUDED.job_assignment,
  activity_log = EXCLUDED.activity_log,
  custom_job_types = EXCLUDED.custom_job_types,
  csv_export = EXCLUDED.csv_export,
  pdf_invoices = EXCLUDED.pdf_invoices,
  customer_quote_page = EXCLUDED.customer_quote_page,
  pricing_rules = EXCLUDED.pricing_rules,
  calendar_full = EXCLUDED.calendar_full,
  calendar_drag = EXCLUDED.calendar_drag;

-- Also insert a trial plan (same as Pro for 14 days)
INSERT INTO plan_features (
  plan, max_users, max_active_jobs, max_customers,
  multi_line_quotes, invoicing, multi_invoice,
  expenses, insights_basic, insights_advanced, smart_alerts,
  communications, team_management, job_assignment, activity_log,
  custom_job_types, csv_export, pdf_invoices,
  customer_quote_page, pricing_rules, calendar_full, calendar_drag
) VALUES
  ('trial', 3, NULL, NULL,
   true, true, true,
   true, true, true, true,
   true, true, true, true,
   true, true, true,
   true, true, true, true)
ON CONFLICT (plan) DO UPDATE SET
  max_users = EXCLUDED.max_users,
  max_active_jobs = EXCLUDED.max_active_jobs,
  max_customers = EXCLUDED.max_customers,
  multi_line_quotes = EXCLUDED.multi_line_quotes,
  invoicing = EXCLUDED.invoicing,
  multi_invoice = EXCLUDED.multi_invoice,
  expenses = EXCLUDED.expenses,
  insights_basic = EXCLUDED.insights_basic,
  insights_advanced = EXCLUDED.insights_advanced,
  smart_alerts = EXCLUDED.smart_alerts,
  communications = EXCLUDED.communications,
  team_management = EXCLUDED.team_management,
  job_assignment = EXCLUDED.job_assignment,
  activity_log = EXCLUDED.activity_log,
  custom_job_types = EXCLUDED.custom_job_types,
  csv_export = EXCLUDED.csv_export,
  pdf_invoices = EXCLUDED.pdf_invoices,
  customer_quote_page = EXCLUDED.customer_quote_page,
  pricing_rules = EXCLUDED.pricing_rules,
  calendar_full = EXCLUDED.calendar_full,
  calendar_drag = EXCLUDED.calendar_drag;
