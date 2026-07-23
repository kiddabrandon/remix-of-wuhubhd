DROP POLICY IF EXISTS "error_logs_anyone_insert" ON public.error_logs;
REVOKE INSERT ON public.error_logs FROM anon;
CREATE POLICY "error_logs_auth_insert" ON public.error_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);