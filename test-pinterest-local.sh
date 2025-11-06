#!/bin/bash
# Test Pinterest Integration Locally
# This script tests the Pinterest collector without using GitHub Actions

set -e

echo "🔍 Testing Pinterest Integration..."
echo ""

# Check if required env vars are set
if [ -z "$SUPABASE_URL" ]; then
  echo "❌ SUPABASE_URL is not set"
  echo "Please create .env.local with:"
  echo "  SUPABASE_URL=https://your-project.supabase.co"
  echo "  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
  echo "  PINTEREST_ACCESS_TOKEN=your-access-token"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY is not set"
  exit 1
fi

if [ -z "$PINTEREST_ACCESS_TOKEN" ]; then
  echo "❌ PINTEREST_ACCESS_TOKEN is not set"
  exit 1
fi

echo "✅ Environment variables configured"
echo ""

# Set testing limits (reduced for local testing)
export PINTEREST_DAILY_LIMIT=200
export PINTEREST_PER_RUN_BUDGET=5  # Only 5 searches for testing

echo "🚀 Running Pinterest Keyword Collector..."
echo "   - Daily Limit: $PINTEREST_DAILY_LIMIT"
echo "   - This Run Budget: $PINTEREST_PER_RUN_BUDGET"
echo ""

node scripts/pinterest-keyword-collector.mjs

echo ""
echo "✅ Pinterest collection completed!"
echo ""
echo "📊 Check your Supabase database for:"
echo "   - keywords table (new/updated Pinterest keywords)"
echo "   - keyword_metrics_daily (today's metrics)"
echo "   - social_platform_trends (Pinterest-specific data)"
echo "   - trend_series (time-series data)"
echo "   - api_usage_tracking (Pinterest API usage)"
