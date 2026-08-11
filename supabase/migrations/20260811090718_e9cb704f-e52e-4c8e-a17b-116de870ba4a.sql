CREATE TABLE IF NOT EXISTS public.guest_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL UNIQUE,
  user_agent text,
  visits integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.guest_visits TO service_role;
ALTER TABLE public.guest_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_visits_admin_read ON public.guest_visits;
CREATE POLICY guest_visits_admin_read ON public.guest_visits
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.track_guest_visit(_visitor_id text, _user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _visitor_id IS NULL OR length(_visitor_id) < 8 OR length(_visitor_id) > 64 THEN
    RETURN;
  END IF;
  INSERT INTO public.guest_visits (visitor_id, user_agent)
  VALUES (_visitor_id, left(coalesce(_user_agent, ''), 300))
  ON CONFLICT (visitor_id) DO UPDATE
    SET last_seen = now(), visits = public.guest_visits.visits + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_guest_visit(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_user_emails()
RETURNS TABLE (email text, created_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
    SELECT u.email::text, u.created_at, u.last_sign_in_at
    FROM auth.users u
    ORDER BY u.created_at DESC
    LIMIT 500;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_user_emails() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_guest_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN (
    SELECT jsonb_build_object(
      'total', count(*),
      'active24h', count(*) FILTER (WHERE last_seen >= now() - interval '24 hours'),
      'active7d', count(*) FILTER (WHERE last_seen >= now() - interval '7 days'),
      'visits', coalesce(sum(visits), 0)
    ) FROM public.guest_visits
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_guest_stats() TO authenticated;