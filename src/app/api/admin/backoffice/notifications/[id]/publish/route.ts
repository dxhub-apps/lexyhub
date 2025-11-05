/**
 * POST /api/admin/backoffice/notifications/[id]/publish
 * Publish a notification (change status to 'live')
 */

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/backoffice/auth';
import { publishNotification } from '@/lib/notifications/service';
import { getEligibleUsers } from '@/lib/notifications/targeting';
import { createDeliveryRecords } from '@/lib/notifications/delivery';
import { getNotification } from '@/lib/notifications/service';
import { logger } from '@/lib/logger';

const log = logger.child({ api: 'admin/notifications/publish' });

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const adminUser = await requireAdminUser();

    // Get notification to check it exists
    const notification = await getNotification(params.id);
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Publish the notification
    const published = await publishNotification(params.id, adminUser.user.id);

    // Get eligible users for targeting
    const eligibleUsers = await getEligibleUsers(published);

    // Create delivery records
    const channels: string[] = [];
    if (published.show_banner) channels.push('banner');
    if (published.create_inapp) channels.push('inapp');
    if (published.send_email) channels.push('email');

    await createDeliveryRecords(params.id, eligibleUsers, channels);

    log.info(
      {
        notification_id: params.id,
        eligible_users: eligibleUsers.length,
        channels,
      },
      'Published notification and created delivery records'
    );

    return NextResponse.json({
      success: true,
      notification: published,
      eligible_users: eligibleUsers.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (error instanceof Error && error.message === 'Notification not found') {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : 'Unable to publish notification';
    log.error({ error, id: params.id }, 'Failed to publish notification');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
