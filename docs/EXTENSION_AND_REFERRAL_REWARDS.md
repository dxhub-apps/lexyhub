# Extension Trial & Referral Rewards System

**Implementation Date:** November 6, 2025
**Branch:** `claude/lexyhub-pricing-implementation-011CUrNDd27MZaWQjAYrCrFd`

## Overview

This document describes the Chrome Extension trial system and Refer-to-Unlock rewards program for LexyHub.

---

## 1. Chrome Extension 14-Day Pro Trial

### How It Works

**Trigger:** User signs up for LexyHub **through** the Chrome Extension

**Reward:** 14-day Pro trial with full Pro features

**Key Features:**
- One-time activation per account
- Cannot be used if user already has active subscription
- Automatically expires after 14 days
- Tracks activation date to prevent reuse

### Database Schema

**Table:** `user_profiles`

New columns added:
```sql
extension_trial_activated_at timestamptz  -- When trial was activated
extension_trial_expires_at timestamptz    -- When trial expires
```

### API Endpoints

#### Activate Extension Trial
**POST** `/api/ext/activate-trial`

**Request:**
```json
{
  "userId": "user-uuid"
}
```

**Response (Success):**
```json
{
  "activated": true,
  "alreadyActive": false,
  "plan": "pro",
  "expiresAt": "2025-11-20T12:00:00Z",
  "daysRemaining": 14,
  "message": "🎉 Pro trial activated! You have full Pro access for 14 days."
}
```

**Response (Already Active):**
```json
{
  "activated": true,
  "alreadyActive": true,
  "plan": "pro",
  "expiresAt": "2025-11-20T12:00:00Z",
  "daysRemaining": 7
}
```

**Response (Already Used):**
```json
{
  "activated": false,
  "message": "Extension trial can only be activated once per account",
  "previouslyActivatedAt": "2025-10-01T12:00:00Z"
}
```

**Response (Has Subscription):**
```json
{
  "activated": false,
  "message": "You already have an active pro subscription",
  "currentPlan": "pro"
}
```

#### Check Extension Trial Status
**GET** `/api/ext/activate-trial?userId=user-uuid`

**Response:**
```json
{
  "isActive": true,
  "plan": "pro",
  "expiresAt": "2025-11-20T12:00:00Z",
  "daysRemaining": 7,
  "activatedAt": "2025-11-06T12:00:00Z",
  "wasUsed": true
}
```

### UI Components

**ExtensionTrialIndicator** - Shows active trial status
```tsx
<ExtensionTrialIndicator
  daysRemaining={7}
  expiresAt="2025-11-20T12:00:00Z"
/>
```

**ExtensionTrialExpiredNotice** - Shows when trial ends
```tsx
<ExtensionTrialExpiredNotice />
```

### User Flow

1. **User installs Chrome Extension**
2. **User signs up through extension** (not through web)
3. **Extension calls** `/api/ext/activate-trial` with userId
4. **System checks:**
   - No active subscription? ✓
   - Trial never used before? ✓
5. **Activates 14-day Pro trial:**
   - Sets `extension_trial_activated_at`
   - Sets `extension_trial_expires_at` (now + 14 days)
6. **User gets Pro features** via `get_effective_plan()` function
7. **After 14 days:**
   - Trial expires automatically
   - User reverts to Free plan (or paid plan if they upgraded)

---

## 2. Refer-to-Unlock Rewards System

### How It Works

**Mechanism:** Users share their referral link. When friends sign up, both get rewards.

**Rewards:**
- **1 referral** = Basic plan for 3 months
- **3 referrals** = Pro plan for 3 months

**Key Features:**
- Leverages existing affiliate system
- Automatic reward granting via database function
- Pro reward overwrites Basic reward
- Rewards stack duration (can have multiple 3-month periods)

### Database Schema

#### New Table: `referral_rewards`

```sql
CREATE TABLE referral_rewards (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  referral_count int NOT NULL,        -- How many refs at time of unlock
  reward_tier text NOT NULL,          -- 'basic' or 'pro'
  reward_duration_months int NOT NULL, -- 3
  granted_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb
);
```

#### View: `active_referral_rewards`

Shows currently active rewards per user. Pro takes precedence over Basic.

```sql
SELECT
  user_id,
  max(case when reward_tier = 'pro' then 'pro' else 'basic' end) as active_reward_tier,
  max(expires_at) as expires_at,
  count(*) as total_rewards_granted
FROM referral_rewards
WHERE is_active = true AND expires_at > now()
GROUP BY user_id;
```

### Database Functions

#### `get_effective_plan(user_id)`

Returns user's effective plan considering all sources in priority order:

1. **Active paid subscription** (highest priority)
2. **Extension trial** (14-day Pro)
3. **Referral reward** (3-month Basic/Pro)
4. **Regular trial** (from trial_expires_at)
5. **Base plan** (fallback)

**Returns:**
```sql
{
  plan_code: 'pro',
  plan_source: 'referral_reward',
  expires_at: '2025-12-06T12:00:00Z'
}
```

**Plan Sources:**
- `subscription` - Active Stripe subscription
- `extension_trial` - 14-day Pro from extension
- `referral_reward` - Unlocked via referrals
- `trial` - Regular trial period
- `base` - User's base plan (usually 'free')

#### `check_and_grant_referral_rewards(user_id)`

Automatically checks referral count and grants rewards if eligible.

**Logic:**
1. Count successful referrals from `affiliate_referrals` table
2. If count >= 3 and no Pro reward exists → Grant Pro for 3 months
3. If count >= 1 and no Basic reward exists → Grant Basic for 3 months
4. Return result

**Returns:**
```sql
{
  reward_granted: true,
  reward_tier: 'basic',
  message: 'Congratulations! You've unlocked Basic for 3 months with 1 referral(s).'
}
```

### API Endpoints

#### Check Referral Rewards Status
**GET** `/api/referrals/check-rewards?userId=user-uuid`

**Response:**
```json
{
  "referralCount": 2,
  "activeReward": {
    "tier": "basic",
    "expiresAt": "2026-02-06T12:00:00Z"
  },
  "nextReward": {
    "tier": "pro",
    "referralsNeeded": 1
  },
  "progress": {
    "current": 2,
    "next": 3,
    "percentage": 66
  }
}
```

#### Grant Referral Rewards (Auto-Check)
**POST** `/api/referrals/check-rewards`

**Request:**
```json
{
  "userId": "user-uuid"
}
```

**Response (Reward Granted):**
```json
{
  "rewardGranted": true,
  "rewardTier": "basic",
  "message": "Congratulations! You've unlocked Basic for 3 months with 1 referral(s)."
}
```

**Response (No Reward):**
```json
{
  "rewardGranted": false,
  "rewardTier": null,
  "message": "You have 0 referral(s). Need 1 for your next reward!"
}
```

### UI Components

**ReferralRewardsCard** - Complete referral dashboard
```tsx
<ReferralRewardsCard
  referralCode="PARTNER2024"
  referralCount={2}
  activeReward={{ tier: 'basic', expiresAt: '2026-02-06T...' }}
  nextReward={{ tier: 'pro', referralsNeeded: 1 }}
  progress={{ current: 2, next: 3, percentage: 66 }}
/>
```

**Features:**
- Shows referral count and progress bar
- Displays active reward with expiry date
- Copy referral link button
- Reward tiers (1 ref = Basic, 3 refs = Pro)
- "How it works" explanation

### User Flow

1. **User gets affiliate code** (auto-created on signup)
2. **User shares referral link:** `https://lexyhub.com?ref=PARTNER2024`
3. **Friend clicks link and signs up**
   - Affiliate middleware captures ref code
   - Creates record in `affiliate_referrals`
4. **System auto-checks rewards** (via webhook or scheduled job)
   - Calls `check_and_grant_referral_rewards(user_id)`
   - Grants Basic at 1 referral
   - Grants Pro at 3 referrals
5. **User gets notified** (email + in-app banner)
6. **Reward activates immediately:**
   - Shows in billing dashboard
   - `get_effective_plan()` returns reward tier
   - User gets upgraded features for 3 months

### Integration with Affiliate System

**Existing Tables Used:**
- `affiliates` - User's affiliate account and code
- `affiliate_referrals` - Tracks referred users
- `affiliate_clicks` - Click tracking for attribution

**New Functionality:**
- Rewards automatically granted based on referral count
- No manual intervention required
- Works alongside commission system for affiliates

---

## 3. Updated Quota Enforcement

### Changed Behavior

The `use_quota()` RPC function now uses `get_effective_plan()` instead of direct plan lookup.

**Priority Order:**
1. Active subscription → Use subscription plan
2. Extension trial → Use Pro limits
3. Referral reward → Use Basic/Pro limits
4. Trial → Use trial plan limits
5. Base → Use Free limits

**Impact:**
- Extension trial users get Pro quota (500 searches, 50 niches, 500 AI ops)
- Referral reward users get Basic/Pro quota automatically
- Seamless transition when trials/rewards expire

### Example Scenarios

**Scenario 1: Extension Trial Active**
```
User base plan: free
Extension trial: active (Pro for 14 days)
Effective plan: pro
Quota: 500 searches, 50 niches, 500 AI ops
```

**Scenario 2: Referral Reward Active**
```
User base plan: free
Referrals: 1
Reward: Basic for 3 months
Effective plan: basic
Quota: 100 searches, 10 niches, 100 AI ops
```

**Scenario 3: Multiple Active (Priority)**
```
User base plan: free
Subscription: active (Pro)
Extension trial: active
Referral reward: active (Basic)
Effective plan: pro (subscription wins)
Quota: 500 searches (Pro subscription takes priority)
```

**Scenario 4: All Expired**
```
User base plan: free
Extension trial: expired
Referral reward: expired
Effective plan: free
Quota: 10 searches, 1 niche, 10 AI ops
```

---

## 4. Testing Checklist

### Extension Trial

- [ ] Activate trial for new user via extension signup
- [ ] Verify Pro features are available
- [ ] Check trial cannot be activated twice
- [ ] Verify trial expires after 14 days
- [ ] Test that users with subscriptions cannot activate trial
- [ ] Confirm ExtensionTrialIndicator shows correct countdown

### Referral Rewards

- [ ] Share referral link and track click
- [ ] Have friend sign up via referral link
- [ ] Verify `affiliate_referrals` record created
- [ ] Call `check_and_grant_referral_rewards()` manually
- [ ] Verify Basic reward granted at 1 referral
- [ ] Verify Pro reward granted at 3 referrals
- [ ] Test Pro reward overwrites Basic
- [ ] Verify rewards expire after 3 months
- [ ] Confirm ReferralRewardsCard displays correctly

### Quota Enforcement

- [ ] Test quota with extension trial active
- [ ] Test quota with referral reward active
- [ ] Verify correct limits applied for each tier
- [ ] Test priority: subscription > trial > reward > base
- [ ] Confirm automatic expiration handling

---

## 5. Migration Guide

### Run Migrations

```bash
# Apply new migration
supabase migration up

# Or manually apply
psql $DATABASE_URL -f supabase/migrations/0033_extension_trial_and_referral_rewards.sql
```

### Update Extension Code

The Chrome Extension should call `/api/ext/activate-trial` on successful signup:

```typescript
// After user signs up via extension
const response = await fetch('/api/ext/activate-trial', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: user.id }),
});

const data = await response.json();

if (data.activated) {
  // Show success message
  showNotification(`${data.message} - ${data.daysRemaining} days remaining!`);
}
```

### Auto-Check Rewards

Call after new referral signup (e.g., in webhook or cron job):

```typescript
// After affiliate_referrals record created
await fetch('/api/referrals/check-rewards', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: referrer.userId }),
});
```

---

## 6. Monitoring & Analytics

### Key Metrics to Track

**Extension Trials:**
- Trial activation rate (signups via extension / total signups)
- Trial → paid conversion rate
- Average trial usage (searches, niches, AI ops)
- Trial expiration behavior

**Referral Rewards:**
- Referral count distribution (how many users have 1, 2, 3+ refs)
- Reward redemption rate
- Reward → paid conversion rate
- Average time to first referral
- Viral coefficient (referrals per user)

### Queries

**Extension Trial Stats:**
```sql
SELECT
  count(*) FILTER (WHERE extension_trial_activated_at IS NOT NULL) as trials_activated,
  count(*) FILTER (WHERE extension_trial_expires_at > now()) as trials_active,
  count(*) FILTER (WHERE extension_trial_expires_at < now()) as trials_expired,
  round(avg(EXTRACT(DAY FROM extension_trial_expires_at - extension_trial_activated_at))) as avg_trial_days
FROM user_profiles;
```

**Referral Rewards Stats:**
```sql
SELECT
  reward_tier,
  count(*) as total_granted,
  count(*) FILTER (WHERE is_active AND expires_at > now()) as currently_active,
  round(avg(EXTRACT(DAY FROM expires_at - granted_at))) as avg_duration_days
FROM referral_rewards
GROUP BY reward_tier;
```

**Referral Distribution:**
```sql
WITH referral_counts AS (
  SELECT
    a.user_id,
    count(ar.id) as referral_count
  FROM affiliates a
  LEFT JOIN affiliate_referrals ar ON ar.affiliate_id = a.id
  GROUP BY a.user_id
)
SELECT
  referral_count,
  count(*) as user_count
FROM referral_counts
GROUP BY referral_count
ORDER BY referral_count;
```

---

## 7. Email Notifications (TODO)

### Extension Trial Emails

1. **Trial Activated**
   - Subject: "🎉 Your Pro Trial is Active!"
   - Body: Welcome, features overview, expiry date

2. **Trial Expiring Soon** (3 days before)
   - Subject: "Your Pro Trial Ends in 3 Days"
   - Body: Reminder, upgrade CTA

3. **Trial Expired**
   - Subject: "Your Pro Trial Has Ended"
   - Body: Thank you, special upgrade offer

### Referral Reward Emails

1. **Reward Unlocked**
   - Subject: "🎁 You've Unlocked [Basic/Pro] for 3 Months!"
   - Body: Congratulations, what you unlocked, next milestone

2. **Friend Signed Up** (notification)
   - Subject: "Your Friend Joined LexyHub!"
   - Body: Progress update, next reward milestone

3. **Reward Expiring Soon** (7 days before)
   - Subject: "Your [Basic/Pro] Reward Expires Soon"
   - Body: Reminder, upgrade offer

4. **Next Milestone Achieved**
   - Subject: "1 More Referral for Pro!"
   - Body: Progress update, encouragement

---

## 8. Security Considerations

### Extension Trial

✅ **Implemented:**
- One activation per account (tracked via `extension_trial_activated_at`)
- Cannot activate if subscription exists
- Server-side validation only
- Trial expiry enforced via database

⚠️ **Considerations:**
- Extension should verify user actually installed extension
- Consider rate limiting activation endpoint
- Log activation attempts for fraud detection

### Referral Rewards

✅ **Implemented:**
- Uses existing affiliate system (already validated)
- Automatic granting via secure RPC function
- Server-side referral counting
- Expiry enforced via database

⚠️ **Considerations:**
- Monitor for referral fraud (fake signups)
- Consider requiring email verification for referrals
- Rate limit reward checking endpoint
- Add cooldown between reward grants

---

## 9. Future Enhancements

### Extension Trial

- [ ] A/B test trial duration (7 vs 14 vs 30 days)
- [ ] Track feature usage during trial
- [ ] Personalized upgrade offers based on usage
- [ ] Re-engagement campaigns for expired trials

### Referral Rewards

- [ ] Tiered rewards (5 refs = Growth for 1 month?)
- [ ] Bonus rewards for high-quality referrals
- [ ] Leaderboard for top referrers
- [ ] Social sharing tools (Twitter, LinkedIn, etc.)
- [ ] Referral analytics dashboard for users

---

## 10. Support & Troubleshooting

### Common Issues

**Issue:** Extension trial not activating
- **Check:** User already used trial (`extension_trial_activated_at` not null)
- **Check:** User has active subscription
- **Solution:** Show appropriate error message

**Issue:** Referral reward not granted
- **Check:** Referral count in `affiliate_referrals`
- **Check:** Reward already exists in `referral_rewards`
- **Solution:** Manually call `check_and_grant_referral_rewards(user_id)`

**Issue:** Wrong plan showing for user
- **Check:** Call `get_effective_plan(user_id)` to see priority
- **Check:** Expiry dates on trials and rewards
- **Solution:** Verify priority order is correct

### Debug Queries

```sql
-- Check user's effective plan
SELECT * FROM get_effective_plan('USER_UUID');

-- Check extension trial status
SELECT
  extension_trial_activated_at,
  extension_trial_expires_at,
  extension_trial_expires_at > now() as is_active
FROM user_profiles
WHERE user_id = 'USER_UUID';

-- Check referral rewards
SELECT * FROM referral_rewards
WHERE user_id = 'USER_UUID'
ORDER BY granted_at DESC;

-- Check referral count
SELECT count(*) as referral_count
FROM affiliate_referrals ar
INNER JOIN affiliates a ON a.id = ar.affiliate_id
WHERE a.user_id = 'USER_UUID';
```

---

## Summary

✅ **Extension Trial:**
- 14-day Pro trial for extension signups
- One-time activation per account
- Automatic expiration
- Priority over referral rewards but below paid subscriptions

✅ **Referral Rewards:**
- 1 referral = Basic for 3 months
- 3 referrals = Pro for 3 months
- Automatic granting via database function
- Works with existing affiliate system
- Pro reward overwrites Basic

✅ **Quota System:**
- Updated to use `get_effective_plan()`
- Respects priority: subscription > extension trial > referral > trial > base
- Seamless transitions between plan sources

**Files Changed:**
- Migration: `0033_extension_trial_and_referral_rewards.sql`
- API: `/api/ext/activate-trial/route.ts` (renamed from activate-free-plus)
- API: `/api/referrals/check-rewards/route.ts` (new)
- Components: `ExtensionTrialIndicator.tsx`, `ReferralRewardsCard.tsx`
- Config: `plans.ts` (updated constants)
