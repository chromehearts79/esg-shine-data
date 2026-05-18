
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin','editor','viewer');
CREATE TYPE public.esg_type AS ENUM ('E','S','G');
CREATE TYPE public.indicator_type AS ENUM ('quantitative','qualitative');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role = ANY(_roles))
$$;

-- Categories
CREATE TABLE public.indicator_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  esg_type public.esg_type NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.indicator_categories ENABLE ROW LEVEL SECURITY;

-- Indicators
CREATE TABLE public.indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.indicator_categories(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type public.indicator_type NOT NULL DEFAULT 'quantitative',
  unit TEXT,
  description TEXT,
  guideline_ref TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.indicators ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_indicators_category ON public.indicators(category_id);

-- Indicator values
CREATE TABLE public.indicator_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  period_quarter INT,  -- null = 연간, 1..4 = 분기
  numeric_value NUMERIC,
  text_value TEXT,
  source TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (indicator_id, period_year, period_quarter)
);
ALTER TABLE public.indicator_values ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_values_indicator ON public.indicator_values(indicator_id);
CREATE INDEX idx_values_year ON public.indicator_values(period_year);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  diff JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_indicators_updated BEFORE UPDATE ON public.indicators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_values_updated BEFORE UPDATE ON public.indicator_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- new user trigger -> profile + viewer role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies
-- profiles: 본인만 조회/수정, 모두 다른 사람 display_name 조회 가능
CREATE POLICY "profiles read all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles: 본인 역할 조회, admin 전체
CREATE POLICY "user_roles read own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles admin manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- indicator_categories
CREATE POLICY "categories read auth" ON public.indicator_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories admin manage" ON public.indicator_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- indicators
CREATE POLICY "indicators read auth" ON public.indicators FOR SELECT TO authenticated USING (true);
CREATE POLICY "indicators admin manage" ON public.indicators FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- indicator_values
CREATE POLICY "values read auth" ON public.indicator_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "values editor insert" ON public.indicator_values FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::public.app_role[]));
CREATE POLICY "values editor update" ON public.indicator_values FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','editor']::public.app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','editor']::public.app_role[]));
CREATE POLICY "values admin delete" ON public.indicator_values FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- audit_logs: admin만 조회, 시스템 insert
CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit insert auth" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.indicator_values;
ALTER PUBLICATION supabase_realtime ADD TABLE public.indicators;
ALTER TABLE public.indicator_values REPLICA IDENTITY FULL;
ALTER TABLE public.indicators REPLICA IDENTITY FULL;
