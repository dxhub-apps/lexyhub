-- ============================================
-- Fix track_api_usage Function for Daily Tracking
-- Pinterest needs daily tracking, not monthly
-- ============================================

-- Drop the old function if it exists
DROP FUNCTION IF EXISTS public.track_api_usage(TEXT, INTEGER);

-- Create updated function with daily tracking for Pinterest
CREATE OR REPLACE FUNCTION public.track_api_usage(
  p_service TEXT,
  p_requests INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_period TEXT;
  v_limit INTEGER;
BEGIN
  -- Pinterest uses daily tracking (YYYY-MM-DD), others use monthly (YYYY-MM)
  IF p_service = 'pinterest' THEN
    v_period := TO_CHAR(NOW(), 'YYYY-MM-DD');
    v_limit := 200;  -- 200 requests per day
  ELSE
    v_period := TO_CHAR(NOW(), 'YYYY-MM');
    v_limit := CASE p_service
      WHEN 'twitter' THEN 1500
      WHEN 'reddit' THEN 999999
      WHEN 'google_trends' THEN 999999
      WHEN 'tiktok' THEN 0
      ELSE 1000
    END;
  END IF;

  -- Upsert usage record
  INSERT INTO public.api_usage_tracking (
    service,
    period,
    requests_made,
    limit_per_period,
    last_request_at,
    last_reset_at
  )
  VALUES (
    p_service,
    v_period,
    p_requests,
    v_limit,
    NOW(),
    NOW()
  )
  ON CONFLICT (service, period) DO UPDATE SET
    requests_made = api_usage_tracking.requests_made + p_requests,
    last_request_at = NOW(),
    updated_at = NOW();

  -- Log warning if approaching limit
  IF (SELECT requests_made FROM api_usage_tracking WHERE service = p_service AND period = v_period) > (v_limit * 0.9) THEN
    RAISE WARNING 'Service % approaching quota limit for period %', p_service, v_period;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.track_api_usage IS 'Track API usage with daily tracking for Pinterest, monthly for others';

-- Test the function
SELECT track_api_usage('pinterest', 1);

-- Verify it created a daily record
SELECT service, period, requests_made, limit_per_period, last_request_at
FROM api_usage_tracking
WHERE service = 'pinterest'
ORDER BY last_request_at DESC
LIMIT 1;
