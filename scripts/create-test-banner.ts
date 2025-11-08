#!/usr/bin/env tsx
/**
 * Script to create and publish a test banner notification
 * This script requires admin access to run
 *
 * Usage:
 *   npx tsx scripts/create-test-banner.ts
 *
 * Or with environment variables:
 *   ADMIN_USER_ID=<your-admin-user-id> npx tsx scripts/create-test-banner.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || '';

interface CreateNotificationRequest {
  kind: 'banner' | 'inapp' | 'email' | 'mixed';
  category: 'keyword' | 'watchlist' | 'ai' | 'account' | 'system' | 'collab';
  title: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  priority: number;
  icon?: string;
  audience_scope: 'all' | 'plan' | 'user_ids' | 'segment' | 'workspace';
  audience_filter?: Record<string, any>;
  schedule_start_at?: string;
  schedule_end_at?: string;
  show_banner: boolean;
  create_inapp: boolean;
  send_email: boolean;
}

async function createTestBanner() {
  console.log('🚀 Creating test banner notification...\n');

  // Calculate end date (30 days from now)
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  const notificationData: CreateNotificationRequest = {
    kind: 'banner',
    category: 'system',
    title: '👋 Welcome to LexyHub!',
    body: 'Thank you for using LexyHub. We are constantly improving the platform to help you succeed.',
    cta_text: 'Get Started',
    cta_url: '/dashboard',
    severity: 'info',
    priority: 80,
    icon: '👋',
    audience_scope: 'all',
    schedule_start_at: startDate.toISOString(),
    schedule_end_at: endDate.toISOString(),
    show_banner: true,
    create_inapp: true,
    send_email: false,
  };

  try {
    // Step 1: Create the notification
    console.log('📝 Step 1: Creating notification...');
    const createResponse = await fetch(`${BASE_URL}/api/admin/backoffice/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ADMIN_USER_ID,
      },
      body: JSON.stringify(notificationData),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      console.error('❌ Failed to create notification:', error);

      if (createResponse.status === 403) {
        console.error('\n⚠️  Admin access required! Please set ADMIN_USER_ID environment variable.');
        console.error('   Get your admin user ID from Supabase auth.users table.');
      }

      process.exit(1);
    }

    const { notification } = await createResponse.json();
    console.log('✅ Notification created with ID:', notification.id);
    console.log('   Status:', notification.status);
    console.log('   Title:', notification.title);

    // Step 2: Publish the notification
    console.log('\n📢 Step 2: Publishing notification...');
    const publishResponse = await fetch(
      `${BASE_URL}/api/admin/backoffice/notifications/${notification.id}/publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': ADMIN_USER_ID,
        },
      }
    );

    if (!publishResponse.ok) {
      const error = await publishResponse.json();
      console.error('❌ Failed to publish notification:', error);
      process.exit(1);
    }

    const publishResult = await publishResponse.json();
    console.log('✅ Notification published successfully!');
    console.log('   Eligible users:', publishResult.eligible_users);
    console.log('   Status:', publishResult.notification.status);

    console.log('\n🎉 Success! The banner should now be visible in your app.');
    console.log('   Refresh your browser to see the banner at the top of all pages.');
    console.log('\n📍 The banner will also appear:');
    console.log('   - On the dashboard as a NotificationCard');
    console.log('   - In the notification feed (bell icon)');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
if (!ADMIN_USER_ID) {
  console.error('❌ Error: ADMIN_USER_ID environment variable is required');
  console.error('\nUsage:');
  console.error('  ADMIN_USER_ID=<your-admin-user-id> npx tsx scripts/create-test-banner.ts');
  console.error('\nTo find your admin user ID:');
  console.error('  1. Go to Supabase Dashboard > Authentication > Users');
  console.error('  2. Find your user and copy the UUID');
  console.error('  3. Or run: SELECT id FROM auth.users WHERE email = \'your-email@example.com\';');
  process.exit(1);
}

createTestBanner().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
