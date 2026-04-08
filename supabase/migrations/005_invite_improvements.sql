-- =============================================================================
-- 005: Invite System Improvements
-- 1. Update handle_new_user trigger to check invitations by email (not just token)
-- 2. Add RLS policy for owners to delete profiles (remove team members)
-- 3. Tighten invitation RLS so only owners/admins can SELECT invitations
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Updated handle_new_user trigger
--    Now checks for matching invitations by EMAIL in addition to the existing
--    token-based flow. This covers the case where an owner creates an invitation
--    and then tells the employee to sign up with that email address.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _invite_token uuid;
  _invite       record;
  _display_name text;
BEGIN
  -- Extract display name from metadata, fall back to email
  _display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1)
  );

  -- Strategy 1: Check if user signed up with an explicit invitation token
  BEGIN
    _invite_token := (new.raw_user_meta_data ->> 'invitation_token')::uuid;
  EXCEPTION WHEN OTHERS THEN
    _invite_token := NULL;
  END;

  IF _invite_token IS NOT NULL THEN
    SELECT * INTO _invite
    FROM public.invitations
    WHERE token = _invite_token
      AND accepted_at IS NULL
      AND expires_at > now();

    IF FOUND THEN
      INSERT INTO public.profiles (id, org_id, display_name, role)
      VALUES (new.id, _invite.org_id, _display_name, _invite.role)
      ON CONFLICT (id) DO UPDATE SET org_id = _invite.org_id, role = _invite.role;

      UPDATE public.invitations SET accepted_at = now() WHERE id = _invite.id;
      RETURN new;
    END IF;
  END IF;

  -- Strategy 2: Check for pending invitation by email address
  SELECT * INTO _invite
  FROM public.invitations
  WHERE email = new.email
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF _invite IS NOT NULL THEN
    INSERT INTO public.profiles (id, org_id, display_name, role)
    VALUES (new.id, _invite.org_id, _display_name, _invite.role)
    ON CONFLICT (id) DO UPDATE SET org_id = _invite.org_id, role = _invite.role;

    UPDATE public.invitations SET accepted_at = now() WHERE id = _invite.id;
    RETURN new;
  END IF;

  -- No valid invitation -- profile will be created during onboarding
  RETURN new;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Allow owners to DELETE profiles in their org (remove team members)
--    Owners cannot delete their own profile through this policy (enforced in app).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Owners can delete org profiles"
  ON profiles FOR DELETE
  USING (
    org_id = auth_org_id()
    AND id != auth.uid()  -- cannot delete yourself
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'owner'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tighten invitation SELECT to owners/admins only
--    Drop the existing broad select policy and replace with role-restricted one.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Org isolation: select invitations" ON invitations;

CREATE POLICY "Owners and admins can view org invitations"
  ON invitations FOR SELECT
  USING (
    org_id = auth_org_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'admin')
    )
  );
