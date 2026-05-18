## 목표
첫 번째 가입자에게 자동으로 `admin` 권한을 부여한다. 두 번째 이후 가입자는 기존대로 `viewer` 권한을 받는다.

## 구현 방식
기존 `handle_new_user()` 트리거 함수를 수정해 `public.user_roles` 테이블이 비어 있는 경우(=첫 가입자)에만 `admin`을 부여하도록 변경한다. 그 외에는 현재 동작(`viewer`)을 유지한다.

### 마이그레이션 (SQL)
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user boolean;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first_user THEN 'admin'::app_role ELSE 'viewer'::app_role END);

  RETURN NEW;
END $$;
```

트리거 자체(`on_auth_user_created`)는 이미 존재하므로 함수만 교체하면 적용된다.

## 영향 범위
- 이미 가입된 사용자에는 영향 없음 (이 변경 전에 가입한 첫 사용자는 여전히 viewer일 수 있음 → 필요 시 별도로 수동 승격 SQL을 한 번 실행해야 함).
- 프론트엔드 코드 변경 없음.

## 확인 사항
현재 DB에 가입한 사용자가 이미 있다면, 변경 후 다음으로 가입하는 사람은 admin이 되지 않습니다(이미 user_roles에 행이 있으므로). 이 경우:
- (A) 기존 첫 가입자를 admin으로 승격하고 새 가입자는 viewer
- (B) `user_roles`를 비우고 처음부터 다시 (기존 데이터 영향 큼, 비권장)

일반적으로 (A)가 안전합니다. 진행해도 될까요? 진행 승인 시 위 마이그레이션만 적용합니다.
