-- Remove any admin/super_admin roles not belonging to the designated owner account
DELETE FROM public.user_roles ur
WHERE ur.role::text IN ('admin','super_admin')
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = ur.user_id AND lower(u.email) = 'ryanbradley639@gmail.com'
  );

-- Enforce: only the designated owner (with a confirmed email) may hold admin roles
CREATE OR REPLACE FUNCTION public.enforce_single_owner_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role::text IN ('admin','super_admin') THEN
    IF NOT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = NEW.user_id
        AND lower(u.email) = 'ryanbradley639@gmail.com'
        AND u.email_confirmed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Only the designated owner account may hold admin roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_owner_admin_trg ON public.user_roles;
CREATE TRIGGER enforce_single_owner_admin_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_owner_admin();