/**
 * Admin API for individual notification operations
 * GET - Get notification by ID
 * PATCH - Update notification
 * DELETE - Delete notification (soft delete to 'ended' status)
 */

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/backoffice/auth';
import { getNotification, updateNotification, deleteNotification } from '@/lib/notifications/service';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const log = logger.child({ api: 'admin/notifications/[id]' });

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireAdminUser();

    const notification = await getNotification(params.id);

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ notification });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : 'Unable to fetch notification';
    log.error({ error, id: params.id }, 'Failed to fetch notification');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const UpdateNotificationSchema = z.object({
  kind: z.enum(['banner', 'inapp', 'email', 'mixed']).optional(),
  category: z.enum(['keyword', 'watchlist', 'ai', 'account', 'system', 'collab']).optional(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(2000).optional(),
  cta_text: z.string().max(50).optional(),
  cta_url: z.string().url().optional(),
  severity: z.enum(['info', 'success', 'warning', 'critical']).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  icon: z.string().max(50).optional(),
  audience_scope: z.enum(['all', 'plan', 'user_ids', 'segment', 'workspace']).optional(),
  audience_filter: z.record(z.any()).optional(),
  segment_id: z.string().uuid().optional(),
  schedule_start_at: z.string().optional(),
  schedule_end_at: z.string().optional(),
  recurrence: z.enum(['none', 'daily', 'weekly']).optional(),
  timezone: z.string().optional(),
  show_once_per_user: z.boolean().optional(),
  max_impressions_per_user: z.number().int().positive().optional(),
  show_banner: z.boolean().optional(),
  create_inapp: z.boolean().optional(),
  send_email: z.boolean().optional(),
  email_template_key: z.enum(['brief_ready', 'keyword_highlights', 'watchlist_digest', 'billing_event', 'system_announcement']).optional(),
  meta: z.record(z.any()).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const adminUser = await requireAdminUser();

    const body = await request.json();
    const result = UpdateNotificationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const notification = await updateNotification(
      { id: params.id, ...result.data },
      adminUser.user.id
    );

    return NextResponse.json({ notification });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (error instanceof Error && error.message === 'Notification not found') {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : 'Unable to update notification';
    log.error({ error, id: params.id }, 'Failed to update notification');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const adminUser = await requireAdminUser();

    await deleteNotification(params.id, adminUser.user.id);

    return NextResponse.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (error instanceof Error && error.message === 'Notification not found') {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : 'Unable to delete notification';
    log.error({ error, id: params.id }, 'Failed to delete notification');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
