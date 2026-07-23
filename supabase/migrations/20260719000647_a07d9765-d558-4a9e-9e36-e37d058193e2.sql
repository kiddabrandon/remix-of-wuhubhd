
-- Role enum + user_roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- App config (single-row style keyed by name)
CREATE TABLE IF NOT EXISTS public.app_config (
  id text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads config" ON public.app_config;
CREATE POLICY "Anyone reads config" ON public.app_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins insert config" ON public.app_config;
CREATE POLICY "Admins insert config" ON public.app_config
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins update config" ON public.app_config;
CREATE POLICY "Admins update config" ON public.app_config
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins delete config" ON public.app_config;
CREATE POLICY "Admins delete config" ON public.app_config
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Progress: precise resume fields
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS position_seconds numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fully_watched boolean NOT NULL DEFAULT false;

-- Seed default config row
INSERT INTO public.app_config (id, value)
VALUES ('site', '{"serverOrder":[],"animeProviders":["gogoanime","zoro","animepahe"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;
