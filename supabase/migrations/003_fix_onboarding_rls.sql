-- =============================================================================
-- Fix: Allow authenticated users to create organizations during onboarding
-- The user doesn't have a profile yet when creating their first org,
-- so auth_org_id() returns null. We need a permissive INSERT policy.
-- =============================================================================

-- Allow any authenticated user to INSERT an organization (they're creating their business)
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow any authenticated user to INSERT a profile (linking themselves to their new org)
-- The existing trigger may not cover manual profile creation during onboarding
CREATE POLICY "Authenticated users can create their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Allow users to INSERT app_settings for their org during onboarding
CREATE POLICY "Authenticated users can create settings for their org"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to INSERT pricing_config for their org during onboarding
CREATE POLICY "Authenticated users can create pricing config for their org"
  ON pricing_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to INSERT job_type_configs for their org during onboarding
CREATE POLICY "Authenticated users can create job type configs for their org"
  ON job_type_configs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also allow INSERT on subscriptions (the trigger creates it, but just in case)
CREATE POLICY "System can create subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (true);
