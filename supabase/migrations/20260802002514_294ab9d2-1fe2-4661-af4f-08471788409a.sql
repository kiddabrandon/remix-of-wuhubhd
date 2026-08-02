ALTER TABLE public.party_messages REPLICA IDENTITY FULL;
ALTER TABLE public.party_rooms REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.party_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.party_rooms;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'users', (
      SELECT count(*) FROM (
        SELECT id AS uid FROM public.profiles
        UNION SELECT user_id FROM public.user_progress
        UNION SELECT user_id FROM public.user_watchlists
        UNION SELECT user_id FROM public.user_roles
      ) u
    ),
    'plays24h', (SELECT count(*) FROM public.user_progress WHERE updated_at >= now() - interval '24 hours'),
    'plays7d', (SELECT count(*) FROM public.user_progress WHERE updated_at >= now() - interval '7 days'),
    'watchlist', (SELECT count(*) FROM public.user_watchlists),
    'errors24h', (SELECT count(*) FROM public.error_logs WHERE created_at >= now() - interval '24 hours'),
    'top', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT tmdb_id, media_type, max(title) AS title, count(*)::int AS plays
        FROM public.user_progress
        WHERE updated_at >= now() - interval '7 days'
        GROUP BY tmdb_id, media_type
        ORDER BY plays DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;