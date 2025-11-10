# Notification Trigger Reference

This document outlines the automated notification triggers introduced for LexyHub v1. The goal is to guide users from onboarding to retention while surfacing quota, billing, and operational events.

## Helper Utilities

- `public.notify_user` — Central helper that respects per-category preferences, deduplicates via `notification_event_log`, and inserts both notification and delivery rows.
- `notification_event_log` — Prevents duplicate messages for the same user/event pair.
- `next_plan_label(plan)` — Maps a user’s current plan to the next recommended upgrade label.
- `log_pricing_analytics_event(user_id, event_type, metadata)` — Captures upsell CTA analytics in `pricing_analytics`.

## Trigger Matrix

| Area | Trigger Source | Notification | CTA | Notes |
| --- | --- | --- | --- | --- |
| Onboarding | `user_profiles` insert | Welcome banner | — | Banner priority 80, show once per user |
| Onboarding | `extension_sessions` insert | Extension connected | — | Success severity |
| Onboarding | `keyword_search_requests` first insert | First keyword search live | `/keywords` | CTA text “View keyword insights.” |
| Quota | `usage_warnings` insert | 70/90% usage warning | `/pricing` | Mixed delivery, severity escalates |
| Quota | `usage_warnings` threshold ≥100 | Monthly limit reached | `/pricing` | Severity critical |
| Insights | `ai_insights` insert | AI insight ready | `/insights` | Requires `status='ready'` |
| Insights | `keyword_insight_snapshots` insert | Keyword insights updated | `/keywords` | User scoped only |
| Insights | `risk_events` insert | Keyword risky | `/watchlist` | Alerts watchlist owners |
| Insights | `keyword_metrics_daily` insert | Volume jump ≥25% WoW | `/watchlist` | Based on trailing 7-day average |
| Extension | `extension_sessions` terms update | 10+ keywords discovered | `/watchlist` | Fires once per session |
| Extension | `ext_watchlist_upsert_queue` update success | Added to watchlist | `/watchlist` | Severity success |
| Extension | `ext_watchlist_upsert_queue` update failure | Retry keyword add | — | Severity warning |
| Feedback | `ai_failures` insert | AI request failed | — | Warning severity |
| Feedback | `feedback` status planned/done | Feedback reviewed | `/changelog` | Inform submitter |
| Billing | `billing_subscriptions` insert active | Plan active | `/billing` | Mixed delivery |
| Billing | `billing_subscriptions` cancel_at_period_end | Subscription ending | `/billing` | Warning severity |
| Billing | `referral_rewards` insert | Referral reward earned | `/billing` | Mixed delivery |
| Upsell | `upsell_triggers` insert | Upgrade to Pro | `/pricing` | Logs analytics |
| Retention | Daily cron (inactive 14d) | Inactivity reminder | `/keywords` | Runs noon UTC |
| Retention | Weekly cron (watchlist ≥80%) | Watchlist nearly full | `/pricing` | Mondays 09:00 UTC |
| Admin | `system_health_metrics` status!=ok | Crawler degraded | — | Sends to admin users |
| Admin | `data_providers` set disabled | Provider maintenance | — | Notifies linked accounts |

## Delivery Defaults

All triggers target specific users with `audience_scope='user_ids'` and insert a matching `notification_delivery` row in `pending` state. Channel selection honours user notification preferences per category. Email channel is included for `kind='mixed'` when the recipient has email notifications enabled.

## Cron Jobs

Two cron jobs are registered via `pg_cron`:

- `notify_inactive_users_daily` — Runs daily at 12:00 UTC, executes `enqueue_inactive_user_notifications()`.
- `notify_watchlist_capacity_weekly` — Runs Mondays at 09:00 UTC, executes `enqueue_watchlist_capacity_alerts()`.

Both helpers are idempotent and rely on `notification_event_log` to avoid duplicate reminders.

