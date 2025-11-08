/**
 * Script to activate the beta test notification for 20 influencers
 *
 * Usage:
 * 1. Update the INFLUENCER_USER_IDS array below with the actual user IDs
 * 2. Run: npx tsx scripts/activate-beta-notification.ts
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// TODO: Replace these placeholder UUIDs with the actual 20 influencer user IDs
const INFLUENCER_USER_IDS: string[] = [
  // 'uuid-1',
  // 'uuid-2',
  // 'uuid-3',
  // ... add all 20 user IDs here
];

const NOTIFICATION_TITLE = '🎯 Beta Test Program';

async function activateBetaNotification() {
  console.log('🚀 Starting beta notification activation...\n');

  // Validate configuration
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing Supabase configuration');
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  if (INFLUENCER_USER_IDS.length === 0) {
    console.error('❌ Error: No influencer user IDs specified');
    console.error('Please update the INFLUENCER_USER_IDS array in this script');
    process.exit(1);
  }

  if (INFLUENCER_USER_IDS.length !== 20) {
    console.warn(`⚠️  Warning: Expected 20 user IDs but got ${INFLUENCER_USER_IDS.length}`);
    const proceed = process.argv.includes('--force');
    if (!proceed) {
      console.error('Add --force flag to proceed anyway');
      process.exit(1);
    }
  }

  // Create Supabase client with service role
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Step 1: Find the notification
    console.log('📋 Finding beta notification...');
    const { data: notification, error: findError } = await supabase
      .from('notifications')
      .select('*')
      .eq('title', NOTIFICATION_TITLE)
      .eq('category', 'system')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (findError || !notification) {
      console.error('❌ Error: Beta notification not found');
      console.error('Make sure to run the migration first: supabase migration up');
      process.exit(1);
    }

    console.log(`✅ Found notification: ${notification.id}`);
    console.log(`   Status: ${notification.status}`);
    console.log(`   Schedule: ${notification.schedule_start_at} to ${notification.schedule_end_at}\n`);

    // Step 2: Verify users exist
    console.log('👥 Verifying influencer users...');
    const { data: users, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, plan')
      .in('id', INFLUENCER_USER_IDS);

    if (userError) {
      console.error('❌ Error verifying users:', userError.message);
      process.exit(1);
    }

    const foundUserIds = users?.map(u => u.id) || [];
    const missingUserIds = INFLUENCER_USER_IDS.filter(id => !foundUserIds.includes(id));

    if (missingUserIds.length > 0) {
      console.error(`❌ Error: ${missingUserIds.length} user IDs not found:`);
      missingUserIds.forEach(id => console.error(`   - ${id}`));
      process.exit(1);
    }

    console.log(`✅ All ${users?.length} users verified:`);
    users?.forEach(u => console.log(`   - ${u.email} (${u.full_name || 'No name'}) - Plan: ${u.plan}`));
    console.log('');

    // Step 3: Update notification with user IDs and activate
    console.log('🔄 Activating notification...');
    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        audience_filter: {
          user_ids: INFLUENCER_USER_IDS
        },
        status: 'live',
        updated_at: new Date().toISOString()
      })
      .eq('id', notification.id);

    if (updateError) {
      console.error('❌ Error updating notification:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Notification activated\n');

    // Step 4: Create delivery records
    console.log('📬 Creating delivery records...');
    const deliveryRecords = INFLUENCER_USER_IDS.map(userId => ({
      notification_id: notification.id,
      user_id: userId,
      state: 'pending',
      channels: ['banner', 'inapp'],
      created_at: new Date().toISOString()
    }));

    const { error: deliveryError } = await supabase
      .from('notification_delivery')
      .upsert(deliveryRecords, {
        onConflict: 'notification_id,user_id'
      });

    if (deliveryError) {
      console.error('❌ Error creating delivery records:', deliveryError.message);
      process.exit(1);
    }

    console.log(`✅ Created ${deliveryRecords.length} delivery records\n`);

    // Step 5: Verify setup
    console.log('🔍 Verifying setup...');
    const { data: deliveries, error: verifyError } = await supabase
      .from('notification_delivery')
      .select('state, user_id')
      .eq('notification_id', notification.id);

    if (verifyError) {
      console.error('⚠️  Warning: Could not verify delivery records:', verifyError.message);
    } else {
      const pending = deliveries?.filter(d => d.state === 'pending').length || 0;
      const shown = deliveries?.filter(d => d.state === 'shown').length || 0;
      const dismissed = deliveries?.filter(d => d.state === 'dismissed').length || 0;

      console.log(`✅ Delivery status:`);
      console.log(`   - Pending: ${pending}`);
      console.log(`   - Shown: ${shown}`);
      console.log(`   - Dismissed: ${dismissed}`);
      console.log(`   - Total: ${deliveries?.length || 0}\n`);
    }

    console.log('🎉 Beta notification successfully activated!');
    console.log(`\n📅 The notification will be shown until: December 25, 2025`);
    console.log(`\n💡 The 20 influencers will see a blue banner at the top of the app`);
    console.log(`   saying "You're part of our exclusive Beta Test program!"`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Helper function to find users by email (optional)
async function findUsersByEmail(emails: string[]) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, plan')
    .in('email', emails);

  if (error) {
    console.error('Error finding users:', error.message);
    return [];
  }

  return users || [];
}

// Main execution
if (require.main === module) {
  activateBetaNotification().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for use in other scripts
export { activateBetaNotification, findUsersByEmail };
