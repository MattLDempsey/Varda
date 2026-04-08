-- =============================================================================
-- Varda SaaS Platform — Initial Database Schema
-- Multi-tenant business management for tradespeople
-- =============================================================================
-- Multi-tenancy: Every data table includes org_id with RLS policies that
-- restrict access to rows belonging to the authenticated user's organization.
-- Auth flow: Supabase Auth -> profiles table -> org_id -> RLS check
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────────────────────────────────────

create type user_role       as enum ('owner', 'admin', 'member');
create type trade_type      as enum ('electrician', 'plumber', 'builder', 'carpenter', 'painter', 'roofer', 'gas_engineer', 'general', 'other');
create type job_status      as enum ('Lead', 'Quoted', 'Accepted', 'Scheduled', 'In Progress', 'Complete', 'Invoiced', 'Paid');
create type quote_status    as enum ('Draft', 'Sent', 'Viewed', 'Accepted', 'Expired', 'Declined');
create type invoice_status  as enum ('Draft', 'Sent', 'Viewed', 'Paid', 'Overdue');
create type comm_channel    as enum ('email', 'whatsapp');
create type comm_status     as enum ('Sent', 'Delivered', 'Read', 'Failed');
create type event_slot      as enum ('morning', 'afternoon', 'full');
create type event_status    as enum ('Scheduled', 'In Progress', 'Complete');
create type expense_category as enum ('Materials', 'Tools & Equipment', 'Vehicle', 'Insurance', 'Subscriptions', 'Training', 'Other');

-- ─────────────────────────────────────────────────────────────────────────────
-- ORGANIZATIONS
-- The tenant table. Every business on the platform is an organization.
-- ─────────────────────────────────────────────────────────────────────────────

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  trade_type  trade_type not null default 'general',
  phone       text,
  email       text,
  address     text,
  website     text,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- Links auth.users to organizations with a role.
-- id = auth.users.id (1:1 mapping).
-- ─────────────────────────────────────────────────────────────────────────────

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  org_id        uuid not null references organizations(id) on delete cascade,
  display_name  text not null,
  role          user_role not null default 'member',
  created_at    timestamptz not null default now()
);

create index idx_profiles_org_id on profiles(org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────────────────────────────────────────

create table customers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  address1    text,
  address2    text,
  city        text,
  postcode    text,
  notes       text default '',
  created_at  timestamptz not null default now()
);

create index idx_customers_org_id on customers(org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- QUOTES
-- Full quote record including pricing breakdown and lifecycle timestamps.
-- ─────────────────────────────────────────────────────────────────────────────

create table quotes (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references organizations(id) on delete cascade,
  ref                         text not null,
  customer_id                 uuid not null references customers(id) on delete cascade,
  job_type_id                 text,
  job_type_name               text not null,
  description                 text default '',
  quantity                    integer not null default 1,
  difficulty                  integer default 50,
  hassle_factor               integer default 30,
  emergency                   boolean not null default false,
  out_of_hours                boolean not null default false,
  cert_required               boolean not null default false,
  customer_supplies_materials boolean not null default false,
  notes                       text default '',
  -- pricing breakdown
  materials                   numeric(10,2) not null default 0,
  labour                      numeric(10,2) not null default 0,
  certificates                numeric(10,2) not null default 0,
  waste                       numeric(10,2) not null default 0,
  subtotal                    numeric(10,2) not null default 0,
  adjustments                 numeric(10,2) not null default 0,
  net_total                   numeric(10,2) not null default 0,
  vat                         numeric(10,2) not null default 0,
  grand_total                 numeric(10,2) not null default 0,
  margin                      numeric(5,4) default 0,
  est_hours                   numeric(6,1) default 0,
  -- lifecycle
  status                      quote_status not null default 'Draft',
  created_at                  timestamptz not null default now(),
  sent_at                     timestamptz,
  viewed_at                   timestamptz,
  accepted_at                 timestamptz
);

create index idx_quotes_org_id      on quotes(org_id);
create index idx_quotes_customer_id on quotes(customer_id);
create index idx_quotes_status      on quotes(status);
create unique index idx_quotes_org_ref on quotes(org_id, ref);

-- ─────────────────────────────────────────────────────────────────────────────
-- JOBS
-- The core work record — links quote to invoice and tracks progress.
-- ─────────────────────────────────────────────────────────────────────────────

create table jobs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  customer_id     uuid not null references customers(id) on delete cascade,
  quote_id        uuid references quotes(id) on delete set null,
  invoice_id      uuid,  -- FK added after invoices table is created
  job_type        text not null,
  value           numeric(10,2) not null default 0,
  estimated_hours numeric(6,1) default 0,
  actual_hours    numeric(6,1),
  status          job_status not null default 'Lead',
  date            date not null,
  notes           text default '',
  created_at      timestamptz not null default now()
);

create index idx_jobs_org_id      on jobs(org_id);
create index idx_jobs_customer_id on jobs(customer_id);
create index idx_jobs_status      on jobs(status);
create index idx_jobs_date        on jobs(date);
create index idx_jobs_quote_id    on jobs(quote_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────────────────────────────────────────

create table invoices (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  ref             text not null,
  job_id          uuid references jobs(id) on delete set null,
  quote_id        uuid references quotes(id) on delete set null,
  customer_id     uuid not null references customers(id) on delete cascade,
  customer_name   text not null,
  job_type_name   text not null,
  description     text default '',
  net_total       numeric(10,2) not null default 0,
  vat             numeric(10,2) not null default 0,
  grand_total     numeric(10,2) not null default 0,
  status          invoice_status not null default 'Draft',
  due_date        date not null,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  paid_at         timestamptz
);

create index idx_invoices_org_id      on invoices(org_id);
create index idx_invoices_customer_id on invoices(customer_id);
create index idx_invoices_status      on invoices(status);
create index idx_invoices_job_id      on invoices(job_id);
create unique index idx_invoices_org_ref on invoices(org_id, ref);

-- Now add the FK from jobs -> invoices
alter table jobs
  add constraint fk_jobs_invoice_id
  foreign key (invoice_id) references invoices(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEDULE EVENTS
-- Calendar entries for planned / in-progress work.
-- ─────────────────────────────────────────────────────────────────────────────

create table schedule_events (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  job_id          uuid references jobs(id) on delete set null,
  customer_id     uuid references customers(id) on delete set null,
  customer_name   text not null,
  job_type        text not null,
  date            date not null,
  slot            event_slot not null default 'morning',
  status          event_status not null default 'Scheduled',
  notes           text default ''
);

create index idx_schedule_events_org_id  on schedule_events(org_id);
create index idx_schedule_events_date    on schedule_events(date);
create index idx_schedule_events_job_id  on schedule_events(job_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- COMMUNICATIONS LOG
-- Record of every message sent to customers (email, WhatsApp, etc.).
-- ─────────────────────────────────────────────────────────────────────────────

create table communications (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  customer_id     uuid references customers(id) on delete set null,
  customer_name   text not null,
  template_name   text not null,
  channel         comm_channel not null,
  status          comm_status not null default 'Sent',
  date            date not null,
  body            text default ''
);

create index idx_communications_org_id      on communications(org_id);
create index idx_communications_customer_id on communications(customer_id);
create index idx_communications_date        on communications(date);

-- ─────────────────────────────────────────────────────────────────────────────
-- EXPENSES
-- Business expenses, optionally linked to a job.
-- ─────────────────────────────────────────────────────────────────────────────

create table expenses (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  date        date not null,
  supplier    text not null,
  description text default '',
  category    expense_category not null default 'Other',
  amount      numeric(10,2) not null default 0,
  vat         numeric(10,2) not null default 0,
  total       numeric(10,2) not null default 0,
  job_id      uuid references jobs(id) on delete set null,
  receipt     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index idx_expenses_org_id on expenses(org_id);
create index idx_expenses_date   on expenses(date);
create index idx_expenses_job_id on expenses(job_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- APP SETTINGS
-- JSONB column stores the full settings object (business info, working hours,
-- quote config, notification preferences). One row per org.
-- ─────────────────────────────────────────────────────────────────────────────

create table app_settings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null unique references organizations(id) on delete cascade,
  settings_json jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_app_settings_org_id on app_settings(org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- PRICING CONFIG
-- JSONB column stores labour rate, VAT rate, cert fee, multipliers, etc.
-- One row per org.
-- ─────────────────────────────────────────────────────────────────────────────

create table pricing_config (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null unique references organizations(id) on delete cascade,
  config_json jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_pricing_config_org_id on pricing_config(org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- JOB TYPE CONFIGS
-- Per-org job type definitions with pricing defaults.
-- ─────────────────────────────────────────────────────────────────────────────

create table job_type_configs (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  job_type_id         text not null,
  name                text not null,
  base_material_cost  numeric(10,2) not null default 0,
  base_hours          numeric(6,1) not null default 1,
  cert_required       boolean not null default false,
  is_per_unit         boolean not null default false,
  min_charge          numeric(10,2) not null default 0,
  created_at          timestamptz not null default now()
);

create index idx_job_type_configs_org_id on job_type_configs(org_id);
create unique index idx_job_type_configs_org_type on job_type_configs(org_id, job_type_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- INVITATIONS
-- Pending team member invites. Token-based; expires after a set time.
-- ─────────────────────────────────────────────────────────────────────────────

create table invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  email       text not null,
  role        user_role not null default 'member',
  token       uuid not null default gen_random_uuid(),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_invitations_org_id on invitations(org_id);
create unique index idx_invitations_token on invitations(token);
create index idx_invitations_email on invitations(email);

-- =============================================================================
-- HELPER FUNCTION: get the org_id for the currently authenticated user
-- Used by all RLS policies to avoid repeating the subquery.
-- =============================================================================

create or replace function auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- =============================================================================
-- ROW LEVEL SECURITY — Enable RLS on all tables
-- =============================================================================

alter table organizations    enable row level security;
alter table profiles         enable row level security;
alter table customers        enable row level security;
alter table quotes           enable row level security;
alter table jobs             enable row level security;
alter table invoices         enable row level security;
alter table schedule_events  enable row level security;
alter table communications   enable row level security;
alter table expenses         enable row level security;
alter table app_settings     enable row level security;
alter table pricing_config   enable row level security;
alter table job_type_configs enable row level security;
alter table invitations      enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES: organizations
-- Users can read their own org. Only owners can update.
-- Insert is handled by the onboarding flow (service role or explicit policy).
-- ─────────────────────────────────────────────────────────────────────────────

create policy "Users can view their own org"
  on organizations for select
  using (id = auth_org_id());

create policy "Owners can update their org"
  on organizations for update
  using (
    id = auth_org_id()
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'owner'
    )
  );

-- Allow insert during onboarding (user creates org before profile exists)
create policy "Authenticated users can create an org"
  on organizations for insert
  with check (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES: profiles
-- Users can always read their own profile.
-- Users can read all profiles in their org (for team views).
-- Users can update their own profile.
-- Owners/admins can update any profile in their org.
-- Insert is handled during onboarding / invite acceptance.
-- ─────────────────────────────────────────────────────────────────────────────

create policy "Users can view own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Users can view org profiles"
  on profiles for select
  using (org_id = auth_org_id());

create policy "Users can update own profile"
  on profiles for update
  using (id = auth.uid());

create policy "Owners can update org profiles"
  on profiles for update
  using (
    org_id = auth_org_id()
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'owner'
    )
  );

-- Allow insert during onboarding (first profile for new user)
create policy "Authenticated users can create their profile"
  on profiles for insert
  with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS POLICIES: Standard data tables
-- Pattern: SELECT/INSERT/UPDATE/DELETE all scoped to user's org_id.
-- ─────────────────────────────────────────────────────────────────────────────

-- Macro-style: apply the same 4 policies to each org-scoped table.
-- We spell them out explicitly for clarity and auditability.

-- CUSTOMERS

create policy "Org isolation: select customers"
  on customers for select
  using (org_id = auth_org_id());

create policy "Org isolation: insert customers"
  on customers for insert
  with check (org_id = auth_org_id());

create policy "Org isolation: update customers"
  on customers for update
  using (org_id = auth_org_id());

create policy "Org isolation: delete customers"
  on customers for delete
  using (org_id = auth_org_id());

-- QUOTES

create policy "Org isolation: select quotes"
  on quotes for select
  using (org_id = auth_org_id());

create policy "Org isolation: insert quotes"
  on quotes for insert
  with check (org_id = auth_org_id());

create policy "Org isolation: update quotes"
  on quotes for update
  using (org_id = auth_org_id());

create policy "Org isolation: delete quotes"
  on quotes for delete
  using (org_id = auth_org_id());

-- JOBS

create policy "Org isolation: select jobs"
  on jobs for select
  using (org_id = auth_org_id());

create policy "Org isolation: insert jobs"
  on jobs for insert
  with check (org_id = auth_org_id());

create policy "Org isolation: update jobs"
  on jobs for update
  using (org_id = auth_org_id());

create policy "Org isolation: delete jobs"
  on jobs for delete
  using (org_id = auth_org_id());

-- INVOICES

create policy "Org isolation: select invoices"
  on invoices for select
  using (org_id = auth_org_id());

create policy "Org isolation: insert invoices"
  on invoices for insert
  with check (org_id = auth_org_id());

create policy "Org isolation: update invoices"
  on invoices for update
  using (org_id = auth_org_id());

create policy "Org isolation: delete invoices"
  on invoices for delete
  using (org_id = auth_org_id());

-- SCHEDULE EVENTS

create policy "Org isolation: select schedule_events"
  on schedule_events for select
  using (org_id = auth_org_id());

create policy "Org isolation: insert schedule_events"
  on schedule_events for insert
  with check (org_id = auth_org_id());

create policy "Org isolation: update schedule_events"
  on schedule_events for update
  using (org_id = auth_org_id());

create policy "Org isolation: delete schedule_events"
  on schedule_events for delete
  using (org_id = auth_org_id());

-- COMMUNICATIONS

create policy "Org isolation: select communications"
  on communications for select
  using (org_id = auth_org_id());

create policy "Org isolation: insert communications"
  on communications for insert
  with check (org_id = auth_org_id());

create policy "Org isolation: update communications"
  on communications for update
  using (org_id = auth_org_id());

create policy "Org isolation: delete communications"
  on communications for delete
  using (org_id = auth_org_id());

-- EXPENSES

create policy "Org isolation: select expenses"
  on expenses for select
  using (org_id = auth_org_id());

create policy "Org isolation: insert expenses"
  on expenses for insert
  with check (org_id = auth_org_id());

create policy "Org isolation: update expenses"
  on expenses for update
  using (org_id = auth_org_id());

create policy "Org isolation: delete expenses"
  on expenses for delete
  using (org_id = auth_org_id());

-- APP SETTINGS

create policy "Org isolation: select app_settings"
  on app_settings for select
  using (org_id = auth_org_id());

create policy "Org isolation: insert app_settings"
  on app_settings for insert
  with check (org_id = auth_org_id());

create policy "Org isolation: update app_settings"
  on app_settings for update
  using (org_id = auth_org_id());

create policy "Org isolation: delete app_settings"
  on app_settings for delete
  using (org_id = auth_org_id());

-- PRICING CONFIG

create policy "Org isolation: select pricing_config"
  on pricing_config for select
  using (org_id = auth_org_id());

create policy "Org isolation: insert pricing_config"
  on pricing_config for insert
  with check (org_id = auth_org_id());

create policy "Org isolation: update pricing_config"
  on pricing_config for update
  using (org_id = auth_org_id());

create policy "Org isolation: delete pricing_config"
  on pricing_config for delete
  using (org_id = auth_org_id());

-- JOB TYPE CONFIGS

create policy "Org isolation: select job_type_configs"
  on job_type_configs for select
  using (org_id = auth_org_id());

create policy "Org isolation: insert job_type_configs"
  on job_type_configs for insert
  with check (org_id = auth_org_id());

create policy "Org isolation: update job_type_configs"
  on job_type_configs for update
  using (org_id = auth_org_id());

create policy "Org isolation: delete job_type_configs"
  on job_type_configs for delete
  using (org_id = auth_org_id());

-- INVITATIONS
-- Owners/admins can manage invites for their org.
-- Anyone can read an invitation by token (for the accept flow).

create policy "Org isolation: select invitations"
  on invitations for select
  using (org_id = auth_org_id());

create policy "Org isolation: insert invitations"
  on invitations for insert
  with check (
    org_id = auth_org_id()
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

create policy "Org isolation: update invitations"
  on invitations for update
  using (org_id = auth_org_id());

create policy "Org isolation: delete invitations"
  on invitations for delete
  using (
    org_id = auth_org_id()
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

-- =============================================================================
-- TRIGGER: Auto-create profile on signup
-- When a new user is created in auth.users, this trigger fires.
-- If the user signed up via an invitation token (stored in raw_user_meta_data),
-- they are linked to the invitation's org. Otherwise a blank profile is created
-- that will be completed during onboarding.
-- =============================================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _invite_token uuid;
  _invite       record;
  _display_name text;
begin
  -- Extract display name from metadata, fall back to email
  _display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );

  -- Check if user signed up with an invitation token
  _invite_token := (new.raw_user_meta_data ->> 'invitation_token')::uuid;

  if _invite_token is not null then
    -- Look up the invitation
    select * into _invite
    from public.invitations
    where token = _invite_token
      and accepted_at is null
      and expires_at > now();

    if found then
      -- Create profile linked to the invitation's org
      insert into public.profiles (id, org_id, display_name, role)
      values (new.id, _invite.org_id, _display_name, _invite.role);

      -- Mark invitation as accepted
      update public.invitations
      set accepted_at = now()
      where token = _invite_token;

      return new;
    end if;
  end if;

  -- No valid invitation — profile will be created during onboarding
  -- (user creates org first, then creates their profile row)
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- =============================================================================
-- TRIGGER: Auto-update updated_at on settings/pricing tables
-- =============================================================================

create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_app_settings_updated_at
  before update on app_settings
  for each row execute function update_updated_at();

create trigger trg_pricing_config_updated_at
  before update on pricing_config
  for each row execute function update_updated_at();

-- =============================================================================
-- DONE
-- =============================================================================
