/**
 * POST /api/notifications/delivery
 * Track notification delivery actions (view, click, dismiss)
 */

import { NextResponse } from 'next/server';
import { trackDelivery, markAsRead, markAllAsRead } from '@/lib/notifications/delivery';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const log = logger.child({ api: 'notifications/delivery' });

function resolveUserId(req: Request): string | null {
  const headerUserId = req.headers.get('x-user-id');
  return headerUserId;
}

const TrackDeliverySchema = z.object({
  notification_id: z.string().uuid(),
  action: z.enum(['view', 'click', 'dismiss']),
});

const MarkAllReadSchema = z.object({
  mark_all_read: z.literal(true),
});

export async function POST(req: Request): Promise<NextResponse> {
  const userId = resolveUserId(req);

  if (!userId) {
    return NextResponse.json(
      { error: 'x-user-id header is required' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();

    // Check if this is a mark_all_read request
    const markAllReadResult = MarkAllReadSchema.safeParse(body);
    if (markAllReadResult.success) {
      await markAllAsRead(userId);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    // Otherwise, it's a regular track delivery request
    const result = TrackDeliverySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { notification_id, action } = result.data;

    await trackDelivery(userId, { notification_id, action });

    return NextResponse.json({
      success: true,
      message: `Notification ${action} tracked successfully`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to track delivery';
    log.error({ error, user_id: userId }, 'Failed to track delivery');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
