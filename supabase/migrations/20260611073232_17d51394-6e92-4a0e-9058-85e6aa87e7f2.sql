INSERT INTO public.user_roles (user_id, role)
SELECT id, 'editor'::app_role FROM auth.users WHERE email='lck2222@naver.com'
ON CONFLICT (user_id, role) DO NOTHING;
DELETE FROM public.user_roles
WHERE role='viewer'
  AND user_id=(SELECT id FROM auth.users WHERE email='lck2222@naver.com');