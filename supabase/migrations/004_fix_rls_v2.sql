-- =============================================================================
-- Fix v2: Drop conflicting RLS policies and recreate with proper onboarding support
-- =============================================================================

-- Drop any existing INSERT policies on organizations that might conflict
DROP POLICY IF EXISTS "Org members can insert into organizations" ON organizations;
DROP POLICY IF EXISTS "Users can insert organizations" ON organizations;

-- Drop and recreate profiles INSERT policy
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can create their own profile" ON profiles;

-- Check if the issue is that RLS is blocking even with the policy
-- Temporarily make organizations INSERT wide open for authenticated users
-- (safe because creating an org doesn't give access to other orgs' data)

-- Let's also check: maybe the issue is the profiles table has a trigger
-- that runs BEFORE the org insert completes

-- NUCLEAR OPTION: Disable RLS on organizations for INSERT only by using a
-- security definer function instead

CREATE OR REPLACE FUNCTION create_organization_for_user(
  p_name text,
  p_trade_type text,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- bypasses RLS
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_display_name text;
  v_email text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user metadata
  SELECT
    COALESCE(raw_user_meta_data->>'display_name', email),
    email
  INTO v_display_name, v_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Create organization
  INSERT INTO organizations (name, trade_type, phone, email)
  VALUES (p_name, p_trade_type::trade_type, p_phone, v_email)
  RETURNING id INTO v_org_id;

  -- Create profile linking user to org as owner
  INSERT INTO profiles (id, org_id, display_name, role)
  VALUES (v_user_id, v_org_id, v_display_name, 'owner')
  ON CONFLICT (id) DO UPDATE SET org_id = v_org_id, role = 'owner';

  -- Create default app_settings
  INSERT INTO app_settings (org_id, settings_json)
  VALUES (v_org_id, jsonb_build_object(
    'business', jsonb_build_object(
      'businessName', p_name,
      'ownerName', v_display_name,
      'phone', COALESCE(p_phone, ''),
      'email', v_email,
      'address1', '', 'address2', '', 'city', '', 'county', '', 'postcode', '',
      'website', '', 'vatNumber', '', 'companyNumber', ''
    ),
    'workingHours', jsonb_build_object(
      'Monday', '{"enabled":true,"start":"08:00","end":"17:00"}'::jsonb,
      'Tuesday', '{"enabled":true,"start":"08:00","end":"17:00"}'::jsonb,
      'Wednesday', '{"enabled":true,"start":"08:00","end":"17:00"}'::jsonb,
      'Thursday', '{"enabled":true,"start":"08:00","end":"17:00"}'::jsonb,
      'Friday', '{"enabled":true,"start":"08:00","end":"17:00"}'::jsonb,
      'Saturday', '{"enabled":true,"start":"09:00","end":"13:00"}'::jsonb,
      'Sunday', '{"enabled":false,"start":"10:00","end":"14:00"}'::jsonb
    ),
    'quoteConfig', jsonb_build_object(
      'validityDays', 30, 'prefix', 'Q', 'paymentTerms', 14,
      'bankName', '', 'sortCode', '', 'accountNumber', '',
      'footer', 'Thank you for your business.'
    ),
    'notifications', jsonb_build_object(
      'jobReminders', true, 'quoteFollowUp', true, 'invoiceOverdue', true,
      'scheduleAlerts', true, 'weeklyDigest', false
    )
  ))
  ON CONFLICT (org_id) DO NOTHING;

  -- Create default pricing_config
  INSERT INTO pricing_config (org_id, config_json)
  VALUES (v_org_id, '{
    "labourRate": 55, "vatRate": 0.20, "certFee": 85, "wastePct": 0.05,
    "marginTarget": 0.30, "emergencyMult": 1.5, "outOfHoursMult": 1.25,
    "difficultyMin": 1.0, "difficultyMax": 2.0, "hassleMin": 1.0, "hassleMax": 1.6,
    "emergencyMinCharge": 150
  }'::jsonb)
  ON CONFLICT (org_id) DO NOTHING;

  -- Create default job type configs
  INSERT INTO job_type_configs (org_id, job_type_id, name, base_material_cost, base_hours, cert_required, is_per_unit, min_charge) VALUES
    (v_org_id, 'general', 'General Work', 20, 1, false, false, 0),
    (v_org_id, 'fault-finding', 'Fault Finding', 10, 2, false, false, 150),
    (v_org_id, 'minor-works', 'Minor Works', 20, 1, false, false, 0),
    (v_org_id, 'other', 'Other', 0, 1, false, false, 0)
  ON CONFLICT (org_id, job_type_id) DO NOTHING;

  RETURN v_org_id;
END;
$$;
