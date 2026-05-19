-- Extend indicators table
ALTER TABLE public.indicators
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS cycle TEXT,
  ADD COLUMN IF NOT EXISTS input_method TEXT NOT NULL DEFAULT 'table_file',
  ADD COLUMN IF NOT EXISTS evidence_required TEXT,
  ADD COLUMN IF NOT EXISTS writing_guide TEXT,
  ADD COLUMN IF NOT EXISTS excluded_reason TEXT;

CREATE TABLE IF NOT EXISTS public.indicator_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  table_no INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(indicator_id, table_no)
);
ALTER TABLE public.indicator_tables ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.indicator_table_cells_schema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.indicator_tables(id) ON DELETE CASCADE,
  row_no INT NOT NULL,
  col_no INT NOT NULL,
  label TEXT NOT NULL,
  is_input BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(table_id, row_no, col_no)
);
ALTER TABLE public.indicator_table_cells_schema ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.indicator_table_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.indicator_tables(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  row_no INT NOT NULL,
  col_no INT NOT NULL,
  numeric_value NUMERIC,
  text_value TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(table_id, period_year, row_no, col_no)
);
ALTER TABLE public.indicator_table_values ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tv_table_year ON public.indicator_table_values(table_id, period_year);

CREATE TABLE IF NOT EXISTS public.indicator_narratives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  period_quarter INT,
  content TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(indicator_id, period_year, period_quarter)
);
ALTER TABLE public.indicator_narratives ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.indicator_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  period_year INT,
  period_quarter INT,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  note TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.indicator_attachments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_table_values_updated BEFORE UPDATE ON public.indicator_table_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_narratives_updated BEFORE UPDATE ON public.indicator_narratives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "tables read auth" ON public.indicator_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "tables admin manage" ON public.indicator_tables FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "schema read auth" ON public.indicator_table_cells_schema FOR SELECT TO authenticated USING (true);
CREATE POLICY "schema admin manage" ON public.indicator_table_cells_schema FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "tv read auth" ON public.indicator_table_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "tv editor insert" ON public.indicator_table_values FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(),ARRAY['admin'::app_role,'editor'::app_role]));
CREATE POLICY "tv editor update" ON public.indicator_table_values FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(),ARRAY['admin'::app_role,'editor'::app_role])) WITH CHECK (public.has_any_role(auth.uid(),ARRAY['admin'::app_role,'editor'::app_role]));
CREATE POLICY "tv admin delete" ON public.indicator_table_values FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "narr read auth" ON public.indicator_narratives FOR SELECT TO authenticated USING (true);
CREATE POLICY "narr editor insert" ON public.indicator_narratives FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(),ARRAY['admin'::app_role,'editor'::app_role]));
CREATE POLICY "narr editor update" ON public.indicator_narratives FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(),ARRAY['admin'::app_role,'editor'::app_role])) WITH CHECK (public.has_any_role(auth.uid(),ARRAY['admin'::app_role,'editor'::app_role]));
CREATE POLICY "narr admin delete" ON public.indicator_narratives FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "att read auth" ON public.indicator_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "att editor insert" ON public.indicator_attachments FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(),ARRAY['admin'::app_role,'editor'::app_role]));
CREATE POLICY "att editor update" ON public.indicator_attachments FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(),ARRAY['admin'::app_role,'editor'::app_role])) WITH CHECK (public.has_any_role(auth.uid(),ARRAY['admin'::app_role,'editor'::app_role]));
CREATE POLICY "att admin delete" ON public.indicator_attachments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

INSERT INTO storage.buckets (id, name, public) VALUES ('indicator-files','indicator-files',false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "ind-files read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='indicator-files');
CREATE POLICY "ind-files editor insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='indicator-files' AND public.has_any_role(auth.uid(),ARRAY['admin'::app_role,'editor'::app_role]));
CREATE POLICY "ind-files admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='indicator-files' AND public.has_role(auth.uid(),'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.indicator_table_values;
ALTER PUBLICATION supabase_realtime ADD TABLE public.indicator_narratives;
ALTER PUBLICATION supabase_realtime ADD TABLE public.indicator_attachments;

-- Categories reset to E/S/G
DELETE FROM public.indicators;
DELETE FROM public.indicator_categories;
INSERT INTO public.indicator_categories (code,name,esg_type,sort_order) VALUES ('E','환경 (Environment)','E',1),('S','사회 (Social)','S',2),('G','지배구조 (Governance)','G',3);