-- migrate:up
-- Backfill NULL marketplace values in ai_corpus from related keywords table
-- This fixes the bug where ingestion jobs were selecting wrong column name (marketplace vs market)

-- Update corpus records where marketplace is NULL and we can find the keyword
UPDATE public.ai_corpus
SET marketplace = k.market
FROM public.keywords k
WHERE public.ai_corpus.marketplace IS NULL
  AND public.ai_corpus.source_ref->>'keyword_id' IS NOT NULL
  AND k.id = (public.ai_corpus.source_ref->>'keyword_id')::uuid
  AND k.market IS NOT NULL;

-- Log the update
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled marketplace for % ai_corpus records', v_updated_count;
END $$;

-- migrate:down
-- No rollback needed - this is a data correction migration
