-- =============================================================================
-- 006: Add full set of default job types to all orgs missing them
-- Also update the onboarding function to create all 12 types
-- =============================================================================

-- Add missing job types to existing orgs
INSERT INTO job_type_configs (org_id, job_type_id, name, base_material_cost, base_hours, cert_required, is_per_unit, min_charge)
SELECT o.id, jt.job_type_id, jt.name, jt.base_material_cost, jt.base_hours, jt.cert_required, jt.is_per_unit, jt.min_charge
FROM organizations o
CROSS JOIN (VALUES
  ('consumer-unit',   'Consumer Unit',   320,  6,   true,  false, 0),
  ('ev-charger',      'EV Charger',      450,  5,   true,  false, 0),
  ('rewire',          'Rewire',          180,  8,   true,  true,  0),
  ('lighting',        'Lighting',        15,   0.5, false, true,  0),
  ('eicr',            'EICR',            0,    3,   true,  false, 0),
  ('smart-home',      'Smart Home',      200,  6,   false, false, 0),
  ('ethernet',        'Ethernet',        60,   1.5, false, true,  0),
  ('smoke-detectors', 'Smoke Detectors', 35,   0.5, false, true,  0),
  ('cctv',            'CCTV',            150,  4,   false, false, 0)
) AS jt(job_type_id, name, base_material_cost, base_hours, cert_required, is_per_unit, min_charge)
ON CONFLICT (org_id, job_type_id) DO NOTHING;

-- Update the onboarding function to create all 12 types for new orgs
CREATE OR REPLACE FUNCTION create_organization_for_user(
  p_name text,
  p_trade_type text,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Create profile
  INSERT INTO profiles (id, org_id, display_name, role)
  VALUES (v_user_id, v_org_id, v_display_name, 'owner')
  ON CONFLICT (id) DO UPDATE SET org_id = v_org_id, role = 'owner';

  -- Default app_settings
  INSERT INTO app_settings (org_id, settings_json)
  VALUES (v_org_id, jsonb_build_object(
    'business', jsonb_build_object(
      'businessName', p_name, 'ownerName', v_display_name,
      'phone', COALESCE(p_phone, ''), 'email', v_email,
      'address1', '', 'address2', '', 'city', '', 'county', '', 'postcode', '',
      'website', '', 'vatNumber', '', 'companyNumber', ''
    ),
    'workingHours', jsonb_build_object(
      'Monday',    '{"enabled":true,"start":"08:00","end":"17:00"}'::jsonb,
      'Tuesday',   '{"enabled":true,"start":"08:00","end":"17:00"}'::jsonb,
      'Wednesday', '{"enabled":true,"start":"08:00","end":"17:00"}'::jsonb,
      'Thursday',  '{"enabled":true,"start":"08:00","end":"17:00"}'::jsonb,
      'Friday',    '{"enabled":true,"start":"08:00","end":"17:00"}'::jsonb,
      'Saturday',  '{"enabled":true,"start":"09:00","end":"13:00"}'::jsonb,
      'Sunday',    '{"enabled":false,"start":"10:00","end":"14:00"}'::jsonb
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

  -- Default pricing_config
  INSERT INTO pricing_config (org_id, config_json)
  VALUES (v_org_id, '{
    "labourRate": 55, "vatRate": 0.20, "certFee": 85, "wastePct": 0.05,
    "marginTarget": 0.30, "emergencyMult": 1.5, "outOfHoursMult": 1.25,
    "difficultyMin": 1.0, "difficultyMax": 2.0, "hassleMin": 1.0, "hassleMax": 1.6,
    "emergencyMinCharge": 150
  }'::jsonb)
  ON CONFLICT (org_id) DO NOTHING;

  -- All 12 default job type configs
  INSERT INTO job_type_configs (org_id, job_type_id, name, base_material_cost, base_hours, cert_required, is_per_unit, min_charge) VALUES
    (v_org_id, 'consumer-unit',   'Consumer Unit',   320,  6,   true,  false, 0),
    (v_org_id, 'ev-charger',      'EV Charger',      450,  5,   true,  false, 0),
    (v_org_id, 'fault-finding',   'Fault Finding',   10,   2,   false, false, 150),
    (v_org_id, 'rewire',          'Rewire',          180,  8,   true,  true,  0),
    (v_org_id, 'lighting',        'Lighting',        15,   0.5, false, true,  0),
    (v_org_id, 'eicr',            'EICR',            0,    3,   true,  false, 0),
    (v_org_id, 'smart-home',      'Smart Home',      200,  6,   false, false, 0),
    (v_org_id, 'ethernet',        'Ethernet',        60,   1.5, false, true,  0),
    (v_org_id, 'smoke-detectors', 'Smoke Detectors', 35,   0.5, false, true,  0),
    (v_org_id, 'minor-works',     'Minor Works',     20,   1,   false, false, 0),
    (v_org_id, 'cctv',            'CCTV',            150,  4,   false, false, 0),
    (v_org_id, 'other',           'Other',           0,    1,   false, false, 0)
  ON CONFLICT (org_id, job_type_id) DO NOTHING;

  RETURN v_org_id;
END;
$$;
