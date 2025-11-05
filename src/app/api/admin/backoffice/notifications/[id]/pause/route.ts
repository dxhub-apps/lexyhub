/**
 * POST /api/admin/backoffice/notifications/[id]/pause
 * Pause a live notification
 */

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/backoffice/auth';
import { pauseNotification } from '@/lib/notifications/service';
import { logger } from '@/lib/logger';

const log = logger.child({ api: 'admin/notifications/pause' });

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const adminUser = await requireAdminUser();

    const notification = await pauseNotification(params.id, adminUser.id);

    log.info({ notification_id: params.id }, 'Paused notification');

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (error instanceof Error && error.message === 'Notification not found') {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : 'Unable to pause notification';
    log.error({ error, id: params.id }, 'Failed to pause notification');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
