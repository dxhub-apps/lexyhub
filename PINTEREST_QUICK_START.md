# Pinterest Quick Start Guide

## 🚀 TL;DR - Get Pinterest Working in 5 Minutes

### What You Need (Already Have!)
✅ Pinterest app with API access
✅ PINTEREST_ACCESS_TOKEN configured on GitHub
✅ Database migrations applied

### What You DON'T Need
❌ Redirect URI configuration (not used for data collection)
❌ OAuth setup (not implemented yet)

---

## 🎯 Quick Setup

### 1. Get Your Access Token
```
1. Go to https://developers.pinterest.com/
2. My Apps > Your App > Access Token
3. Copy the token (starts with pina_)
```

### 2. Set Environment (Choose One)

**GitHub (Already Done ✅)**
- Settings > Secrets > Actions
- `PINTEREST_ACCESS_TOKEN` = your token

**OR Local Testing**
```bash
# Create .env.local
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PINTEREST_ACCESS_TOKEN=pina_your_token_here
```

### 3. Test It

**Option A: GitHub Actions (Recommended)**
```
1. GitHub > Actions
2. "Pinterest Trends Collector"
3. Run workflow
4. Check logs ✅
```

**Option B: Local Test**
```bash
# Set env vars first, then:
./test-pinterest-local.sh
```

### 4. Verify Results

**In Supabase:**
```sql
-- See collected keywords
SELECT term, source, extras->>'save_count' as saves
FROM keywords
WHERE source = 'pinterest'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📊 What It Does

✅ Runs every 2 hours automatically
✅ Searches 7 product queries per run
✅ Extracts 200-600 keywords daily
✅ Detects seasonal trends
✅ Analyzes engagement & sentiment
✅ Stores in Supabase for multi-platform analysis

---

## ❓ About That Redirect URI Field

**You asked about redirect URIs in your Pinterest app.**

For the **current implementation** (server-to-server data collection):

🔹 **Redirect URI is NOT used**
🔹 You can set it to `http://localhost:3000` or any valid URL
🔹 It's only needed if you implement OAuth later (user account linking)

The current system uses a **direct access token**, not OAuth flow.

---

## 🎉 You're Done!

Your Pinterest integration is **fully functional** for trend collection.

The redirect URI requirement you saw is for **future OAuth** (if you want users to connect their Pinterest accounts). For now, just set it to any valid URL and ignore it.

**Next Steps:**
1. Run the GitHub Actions workflow (or local test)
2. Check results in Supabase
3. Watch the trends come in! 📈

---

## 🆘 Need Help?

See `PINTEREST_SETUP.md` for detailed documentation.

**Common Questions:**

**Q: Do I need to configure the redirect URI?**
A: No, not for the current data collection setup.

**Q: How do I test if it's working?**
A: Run `./test-pinterest-local.sh` or check GitHub Actions logs.

**Q: Where does the data go?**
A: Supabase tables: `keywords`, `keyword_metrics_daily`, `social_platform_trends`.

**Q: How often does it run?**
A: Every 2 hours, 12 times per day.

**Q: What's the daily limit?**
A: 200 API requests/day (free tier).

---

## 📁 Files Created

- `PINTEREST_SETUP.md` - Full documentation
- `test-pinterest-local.sh` - Local testing script
- `PINTEREST_QUICK_START.md` - This file

**Existing Files:**
- `scripts/pinterest-keyword-collector.mjs` - Collector script
- `.github/workflows/pinterest-trends-collector.yml` - Workflow
- `supabase/migrations/0031_social_metrics_and_watchlist.sql` - DB schema
