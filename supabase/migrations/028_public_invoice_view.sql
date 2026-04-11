-- =============================================================================
-- Public invoice viewing
-- =============================================================================
-- The /invoice/:invoiceId page is a customer-facing public link, so it cannot
-- rely on RLS-protected reads. These SECURITY DEFINER functions return only the
-- fields needed by the customer-facing view and update lifecycle status without
-- requiring authentication.
-- =============================================================================

-- Returns a JSON blob containing the invoice, its customer, linked quote info,
-- and the issuing business's display info. Returns NULL if not found.
CREATE OR REPLACE FUNCTION get_public_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'invoice', jsonb_build_object(
      'id',             i.id,
      'ref',            i.ref,
      'customer_name',  i.customer_name,
      'job_type_name',  i.job_type_name,
      'description',    i.description,
      'type',           i.type,
      'net_total',      i.net_total,
      'vat',            i.vat,
      'grand_total',    i.grand_total,
      'status',         i.status,
      'created_at',     i.created_at,
      'sent_at',        i.sent_at,
      'paid_at',        i.paid_at,
      'due_date',       i.due_date
    ),
    'customer', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name',     c.name,
      'address1', c.address1,
      'address2', c.address2,
      'city',     c.city,
      'postcode', c.postcode
    ) END,
    'quote', CASE WHEN q.id IS NULL THEN NULL ELSE jsonb_build_object(
      'certificates', q.certificates
    ) END,
    'business', COALESCE(s.settings_json->'business', '{}'::jsonb),
    'quoteConfig', COALESCE(s.settings_json->'quoteConfig', '{}'::jsonb)
  ) INTO v_result
  FROM invoices i
  LEFT JOIN customers c    ON c.id = i.customer_id
  LEFT JOIN quotes q       ON q.id = i.quote_id
  LEFT JOIN app_settings s ON s.org_id = i.org_id
  WHERE i.id = p_invoice_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_invoice(uuid) TO anon, authenticated;

-- Marks an invoice as Viewed the first time the customer opens the link.
-- Only transitions Sent -> Viewed (no-ops on any other state).
CREATE OR REPLACE FUNCTION mark_invoice_viewed(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE invoices
  SET status = 'Viewed'
  WHERE id = p_invoice_id AND status = 'Sent';
END;
$$;

GRANT EXECUTE ON FUNCTION mark_invoice_viewed(uuid) TO anon, authenticated;
