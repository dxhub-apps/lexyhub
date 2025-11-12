-- Enable Supabase Realtime for notification tables
-- This allows clients to subscribe to real-time changes instead of polling

-- Enable replica identity for notification_delivery table
-- This is required for Supabase Realtime to track changes
alter table public.notification_delivery replica identity full;

-- Enable replica identity for notifications table
-- This allows tracking changes to notification status, etc.
alter table public.notifications replica identity full;

-- Add tables to the supabase_realtime publication
-- This makes changes to these tables available to realtime subscriptions
alter publication supabase_realtime add table public.notification_delivery;
alter publication supabase_realtime add table public.notifications;

-- Add comment explaining the purpose
comment on table public.notification_delivery is
  'Per-user delivery tracking. Realtime enabled for instant notification updates without polling.';

comment on table public.notifications is
  'Central notification definitions for banner, in-app, and email channels. Realtime enabled for instant status updates.';
