
-- 1) Last-admin protection trigger
CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_admins int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'admin' THEN
      SELECT count(*) INTO remaining_admins FROM public.user_roles WHERE role='admin' AND user_id <> OLD.user_id;
      IF remaining_admins = 0 THEN
        RAISE EXCEPTION '마지막 관리자는 강등/삭제할 수 없습니다.';
      END IF;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'admin' AND NEW.role <> 'admin' THEN
      SELECT count(*) INTO remaining_admins FROM public.user_roles WHERE role='admin' AND user_id <> OLD.user_id;
      IF remaining_admins = 0 THEN
        RAISE EXCEPTION '마지막 관리자는 강등할 수 없습니다.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_last_admin_del ON public.user_roles;
DROP TRIGGER IF EXISTS trg_prevent_last_admin_upd ON public.user_roles;
CREATE TRIGGER trg_prevent_last_admin_del BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_removal();
CREATE TRIGGER trg_prevent_last_admin_upd BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_removal();

-- 2) Admin-only user listing function
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  role app_role
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.display_name, u.created_at, ur.role
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    ORDER BY u.created_at NULLS LAST;
END $$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- 3) Admin-only role change function (single role per user, atomic, with audit)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_target uuid, _new_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old_role app_role;
  _actor uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_actor, 'admin') THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  SELECT role INTO _old_role FROM public.user_roles WHERE user_id = _target LIMIT 1;

  IF _old_role IS NOT DISTINCT FROM _new_role THEN
    RETURN;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, _new_role);

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
  VALUES (_actor, 'role_change', 'user_roles', _target,
          jsonb_build_object('from', _old_role, 'to', _new_role));
END $$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) TO authenticated;
