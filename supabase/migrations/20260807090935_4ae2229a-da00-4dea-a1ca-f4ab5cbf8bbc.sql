REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.download_entitlement() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_progress_lww() FROM anon, PUBLIC;