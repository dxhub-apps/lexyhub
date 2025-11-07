-- Migration: LexyBrain Extension Configuration
-- Description: Add remote config flags for controlling LexyBrain features in Chrome extension
-- Version: 0038
-- Created: 2025-11-07

-- Add LexyBrain extension configuration to remote_config
INSERT INTO extension_remote_config (key, value, description)
VALUES
  (
    'lexybrain_extension_enabled',
    'true',
    'Master switch to enable/disable LexyBrain features in Chrome extension'
  ),
  (
    'lexybrain_extension_default_type',
    'radar',
    'Default insight type for quick insights (market_brief, radar, ad_insight, risk)'
  ),
  (
    'lexybrain_extension_show_quota',
    'true',
    'Show quota badge and status in extension UI'
  ),
  (
    'lexybrain_extension_max_keywords',
    '10',
    'Maximum number of keywords allowed per insight request from extension'
  ),
  (
    'lexybrain_extension_show_tooltip',
    'true',
    'Show AI scores in keyword tooltips on marketplace pages'
  ),
  (
    'lexybrain_extension_context_menu',
    'true',
    'Enable "Get AI Insight" in context menu for selected text'
  ),
  (
    'lexybrain_extension_floating_button',
    'true',
    'Show floating AI insight button on marketplace pages'
  )
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- Add index for faster remote config lookups
CREATE INDEX IF NOT EXISTS idx_extension_remote_config_key
  ON extension_remote_config (key);

-- Add comment explaining LexyBrain extension integration
COMMENT ON TABLE extension_remote_config IS 'Remote configuration for Chrome extension features including LexyBrain AI insights. Updated dynamically without requiring extension updates.';
