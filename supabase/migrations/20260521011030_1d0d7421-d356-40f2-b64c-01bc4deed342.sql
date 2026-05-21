-- 1) Cleanup duplicates on (indicator_id, period_year) where period_quarter IS NULL
DELETE FROM public.indicator_narratives a
USING public.indicator_narratives b
WHERE a.period_quarter IS NULL
  AND b.period_quarter IS NULL
  AND a.indicator_id = b.indicator_id
  AND a.period_year = b.period_year
  AND (a.updated_at < b.updated_at
       OR (a.updated_at = b.updated_at AND a.ctid < b.ctid));

-- 2) Drop existing UNIQUE constraint if present
DO $$
DECLARE
  c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.indicator_narratives'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(indicator_id, period_year, period_quarter)%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.indicator_narratives DROP CONSTRAINT %I', c);
  END IF;
END $$;

-- Drop matching unique index if it remains
DROP INDEX IF EXISTS public.indicator_narratives_indicator_id_period_year_period_quart_key;

-- 3) NULL-safe partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS indicator_narratives_uniq_quarter_null
  ON public.indicator_narratives (indicator_id, period_year)
  WHERE period_quarter IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS indicator_narratives_uniq_quarter_notnull
  ON public.indicator_narratives (indicator_id, period_year, period_quarter)
  WHERE period_quarter IS NOT NULL;

-- 4) updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at_indicator_table_values ON public.indicator_table_values;
CREATE TRIGGER set_updated_at_indicator_table_values
  BEFORE UPDATE ON public.indicator_table_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_indicator_narratives ON public.indicator_narratives;
CREATE TRIGGER set_updated_at_indicator_narratives
  BEFORE UPDATE ON public.indicator_narratives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();