-- =============================================================================
-- Public quote viewing
-- =============================================================================
-- The /q/:quoteId page is a customer-facing public link, so it cannot rely on
-- RLS-protected reads. These SECURITY DEFINER functions return only the fields
-- needed by the customer-facing view and update lifecycle status without
-- requiring authentication.
-- =============================================================================

-- Returns a JSON blob containing the quote, its customer, and the issuing
-- business's display info. Returns NULL if the quote does not exist.
CREATE OR REPLACE FUNCTION get_public_quote(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'quote', jsonb_build_object(
      'id',             q.id,
      'ref',            q.ref,
      'customer_name',  q.customer_name,
      'job_type_name',  q.job_type_name,
      'description',    q.description,
      'net_total',      q.net_total,
      'certificates',   q.certificates,
      'vat',            q.vat,
      'grand_total',    q.grand_total,
      'status',         q.status,
      'notes',          q.notes,
      'created_at',     q.created_at,
      'sent_at',        q.sent_at,
      'viewed_at',      q.viewed_at,
      'accepted_at',    q.accepted_at
    ),
    'customer', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name',     c.name,
      'address1', c.address1,
      'address2', c.address2,
      'city',     c.city,
      'postcode', c.postcode
    ) END,
    'business', COALESCE(s.settings_json->'business', '{}'::jsonb)
  ) INTO v_result
  FROM quotes q
  LEFT JOIN customers c    ON c.id = q.customer_id
  LEFT JOIN app_settings s ON s.org_id = q.org_id
  WHERE q.id = p_quote_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_quote(uuid) TO anon, authenticated;

-- Marks a quote as Viewed the first time the customer opens the link.
-- Only transitions Sent -> Viewed (no-ops on any other state).
CREATE OR REPLACE FUNCTION mark_quote_viewed(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE quotes
  SET status = 'Viewed', viewed_at = now()
  WHERE id = p_quote_id AND status = 'Sent';
END;
$$;

GRANT EXECUTE ON FUNCTION mark_quote_viewed(uuid) TO anon, authenticated;

-- Accepts a public quote and advances the linked job to Accepted.
-- Returns true if any state actually changed.
CREATE OR REPLACE FUNCTION accept_public_quote(p_quote_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE quotes
  SET status = 'Accepted', accepted_at = now()
  WHERE id = p_quote_id AND status IN ('Sent', 'Viewed', 'Draft');

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    -- Advance the linked job (if any) to Accepted
    UPDATE jobs
    SET status = 'Accepted'
    WHERE quote_id = p_quote_id
      AND status IN ('Lead', 'Quoted');
  END IF;

  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_public_quote(uuid) TO anon, authenticated;
