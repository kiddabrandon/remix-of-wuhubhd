DROP POLICY IF EXISTS party_rooms_read_all ON public.party_rooms;
CREATE POLICY party_rooms_read_auth ON public.party_rooms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS party_messages_read_all ON public.party_messages;
CREATE POLICY party_messages_read_auth ON public.party_messages FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.party_rooms FROM anon;
REVOKE SELECT ON public.party_messages FROM anon;

DROP POLICY IF EXISTS user_roles_admin_write ON public.user_roles;
CREATE POLICY user_roles_admin_write ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON FUNCTION public.grant_admin_for_designated_email() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_stats() FROM anon;

CREATE TABLE public.download_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier text NOT NULL CHECK (tier IN ('single','week','lifetime')),
  amount_kes integer NOT NULL,
  credits_granted integer NOT NULL DEFAULT 0,
  unlimited boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  provider text NOT NULL DEFAULT 'manual',
  provider_ref text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX download_purchases_user_idx ON public.download_purchases (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.download_purchases TO authenticated;
GRANT ALL ON public.download_purchases TO service_role;
ALTER TABLE public.download_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY dp_select_own ON public.download_purchases FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY dp_insert_own ON public.download_purchases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE TABLE public.download_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tmdb_id integer,
  media_type text NOT NULL DEFAULT 'movie',
  title text NOT NULL,
  poster_path text,
  season integer,
  episode integer,
  quality text NOT NULL DEFAULT '1080p',
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started','handed_off','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX download_events_user_idx ON public.download_events (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.download_events TO authenticated;
GRANT ALL ON public.download_events TO service_role;
ALTER TABLE public.download_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY de_select_own ON public.download_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY de_insert_own ON public.download_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.download_entitlement()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH active AS (
    SELECT * FROM public.download_purchases
    WHERE user_id = auth.uid() AND status = 'paid'
      AND (expires_at IS NULL OR expires_at > now())
  ), used AS (
    SELECT count(*)::int AS n FROM public.download_events
    WHERE user_id = auth.uid() AND status <> 'failed'
  )
  SELECT jsonb_build_object(
    'unlimited', COALESCE((SELECT bool_or(unlimited) FROM active), false),
    'granted', COALESCE((SELECT sum(credits_granted) FROM active), 0),
    'used', (SELECT n FROM used),
    'remaining', GREATEST(COALESCE((SELECT sum(credits_granted) FROM active), 0) - (SELECT n FROM used), 0),
    'tier', (SELECT tier FROM active ORDER BY CASE tier WHEN 'lifetime' THEN 0 WHEN 'week' THEN 1 ELSE 2 END LIMIT 1),
    'expires_at', (SELECT max(expires_at) FROM active)
  );
$$;
REVOKE ALL ON FUNCTION public.download_entitlement() FROM anon;
GRANT EXECUTE ON FUNCTION public.download_entitlement() TO authenticated;