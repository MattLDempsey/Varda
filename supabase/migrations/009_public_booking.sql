-- Public booking RPC functions (SECURITY DEFINER — no auth required)

-- 1. Create a public booking (inserts customer + lead job)
CREATE OR REPLACE FUNCTION create_public_booking(
  p_org_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_preferred_date text,
  p_preferred_slot text,
  p_description text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_job_id uuid;
BEGIN
  -- Create or find customer
  SELECT id INTO v_customer_id FROM customers
  WHERE org_id = p_org_id AND email = p_customer_email LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO customers (org_id, name, phone, email, address1, address2, city, postcode, notes)
    VALUES (p_org_id, p_customer_name, p_customer_phone, p_customer_email, '', '', '', '', 'Booked online')
    RETURNING id INTO v_customer_id;
  END IF;

  -- Create lead job
  INSERT INTO jobs (org_id, customer_id, job_type, value, estimated_hours, status, date, notes)
  VALUES (p_org_id, v_customer_id, 'TBC', 0, 0, 'Lead', p_preferred_date,
    'Online booking: ' || p_description || ' (Preferred: ' || p_preferred_slot || ')')
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

-- 2. Get public org info (name, trade type, phone, working hours)
CREATE OR REPLACE FUNCTION get_public_org_info(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'name', o.name,
    'trade_type', o.trade_type,
    'phone', o.phone,
    'settings', s.settings_json
  ) INTO v_result
  FROM organizations o
  LEFT JOIN app_settings s ON s.org_id = o.id
  WHERE o.id = p_org_id;

  RETURN v_result;
END;
$$;
