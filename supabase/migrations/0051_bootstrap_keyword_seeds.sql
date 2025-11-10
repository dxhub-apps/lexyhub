-- ===========================================
-- 0051_bootstrap_keyword_seeds.sql
-- Bootstrap keyword_seeds with curated marketplace niches
-- ===========================================

-- migrate:up

-- Ensure we have the base schema enhancements
-- (0036_dataforseo_k4k_support.sql should already exist)

-- Insert bootstrap seed keywords for marketplace research
-- Priority levels: 10=highest, 9=high, 8=medium
INSERT INTO public.keyword_seeds (term, market, language_code, location_code, priority, status, enabled)
VALUES
  -- Jewelry & Accessories (Priority 10 - High commercial intent)
  ('necklace', 'google', 'en', '2840', 10, 'pending', true),
  ('bracelet', 'google', 'en', '2840', 10, 'pending', true),
  ('earrings', 'google', 'en', '2840', 10, 'pending', true),
  ('ring', 'google', 'en', '2840', 10, 'pending', true),
  ('jewelry', 'google', 'en', '2840', 10, 'pending', true),

  -- Apparel (Priority 10)
  ('t-shirt', 'google', 'en', '2840', 10, 'pending', true),
  ('hoodie', 'google', 'en', '2840', 10, 'pending', true),
  ('sweatshirt', 'google', 'en', '2840', 10, 'pending', true),
  ('dress', 'google', 'en', '2840', 10, 'pending', true),

  -- Print-on-Demand (Priority 9)
  ('mug', 'google', 'en', '2840', 9, 'pending', true),
  ('poster', 'google', 'en', '2840', 9, 'pending', true),
  ('canvas print', 'google', 'en', '2840', 9, 'pending', true),
  ('tote bag', 'google', 'en', '2840', 9, 'pending', true),
  ('sticker', 'google', 'en', '2840', 9, 'pending', true),
  ('phone case', 'google', 'en', '2840', 9, 'pending', true),

  -- Home Decor (Priority 9)
  ('wall art', 'google', 'en', '2840', 9, 'pending', true),
  ('throw pillow', 'google', 'en', '2840', 9, 'pending', true),
  ('blanket', 'google', 'en', '2840', 9, 'pending', true),
  ('candle', 'google', 'en', '2840', 9, 'pending', true),

  -- Digital Products (Priority 9)
  ('digital planner', 'google', 'en', '2840', 9, 'pending', true),
  ('printable art', 'google', 'en', '2840', 9, 'pending', true),
  ('svg file', 'google', 'en', '2840', 9, 'pending', true),
  ('digital download', 'google', 'en', '2840', 9, 'pending', true),

  -- Event & Occasions (Priority 8)
  ('wedding invitation', 'google', 'en', '2840', 8, 'pending', true),
  ('birthday card', 'google', 'en', '2840', 8, 'pending', true),
  ('baby shower', 'google', 'en', '2840', 8, 'pending', true),
  ('bridal shower', 'google', 'en', '2840', 8, 'pending', true),

  -- Pets (Priority 8)
  ('pet portrait', 'google', 'en', '2840', 8, 'pending', true),
  ('dog collar', 'google', 'en', '2840', 8, 'pending', true),
  ('cat toy', 'google', 'en', '2840', 8, 'pending', true),

  -- Seasonal/Holiday (Priority 8)
  ('christmas ornament', 'google', 'en', '2840', 8, 'pending', true),
  ('halloween decoration', 'google', 'en', '2840', 8, 'pending', true),
  ('valentine gift', 'google', 'en', '2840', 8, 'pending', true),

  -- Accessories (Priority 8)
  ('keychain', 'google', 'en', '2840', 8, 'pending', true),
  ('bookmark', 'google', 'en', '2840', 8, 'pending', true),
  ('pin badge', 'google', 'en', '2840', 8, 'pending', true)

ON CONFLICT (term_normalized, market) DO NOTHING;

-- Create index for efficient seed selection by priority
CREATE INDEX IF NOT EXISTS keyword_seeds_priority_created_idx
  ON public.keyword_seeds (priority DESC, created_at ASC)
  WHERE enabled = true AND status IN ('pending', 'error');

-- Add comment explaining bootstrap source
COMMENT ON TABLE public.keyword_seeds IS
  'Seed keywords for DataForSEO K4K expansion. Bootstrap seeds marked with priority 8-10 represent curated marketplace niches with high commercial intent.';

-- migrate:down

-- Remove bootstrap seeds
DELETE FROM public.keyword_seeds
WHERE term IN (
  'necklace', 'bracelet', 'earrings', 'ring', 'jewelry',
  't-shirt', 'hoodie', 'sweatshirt', 'dress',
  'mug', 'poster', 'canvas print', 'tote bag', 'sticker', 'phone case',
  'wall art', 'throw pillow', 'blanket', 'candle',
  'digital planner', 'printable art', 'svg file', 'digital download',
  'wedding invitation', 'birthday card', 'baby shower', 'bridal shower',
  'pet portrait', 'dog collar', 'cat toy',
  'christmas ornament', 'halloween decoration', 'valentine gift',
  'keychain', 'bookmark', 'pin badge'
)
AND market = 'google';

DROP INDEX IF EXISTS public.keyword_seeds_priority_created_idx;
