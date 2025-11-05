/**
 * Admin API for notifications CRUD
 * GET - List all notifications with filters
 * POST - Create new notification
 */

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/backoffice/auth';
import { createNotification, listNotifications } from '@/lib/notifications/service';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const log = logger.child({ api: 'admin/notifications' });

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const adminUser = await requireAdminUser();

    const { searchParams } = new URL(request.url);
    const params = {
      status: searchParams.get('status') as any,
      kind: searchParams.get('kind') as any,
      severity: searchParams.get('severity') as any,
      category: searchParams.get('category') as any,
      source: searchParams.get('source') as any,
      q: searchParams.get('q') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '25', 10),
    };

    const result = await listNotifications(params);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : 'Unable to list notifications';
    log.error({ error }, 'Failed to list notifications');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const CreateNotificationSchema = z.object({
  kind: z.enum(['banner', 'inapp', 'email', 'mixed']),
  category: z.enum(['keyword', 'watchlist', 'ai', 'account', 'system', 'collab']),
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional(),
  cta_text: z.string().max(50).optional(),
  cta_url: z.string().url().optional(),
  severity: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
  priority: z.number().int().min(0).max(100).default(50),
  icon: z.string().max(50).optional(),
  audience_scope: z.enum(['all', 'plan', 'user_ids', 'segment', 'workspace']).default('all'),
  audience_filter: z.record(z.any()).default({}),
  segment_id: z.string().uuid().optional(),
  schedule_start_at: z.string().optional(),
  schedule_end_at: z.string().optional(),
  recurrence: z.enum(['none', 'daily', 'weekly']).default('none'),
  timezone: z.string().default('UTC'),
  show_once_per_user: z.boolean().default(false),
  max_impressions_per_user: z.number().int().positive().optional(),
  show_banner: z.boolean().default(false),
  create_inapp: z.boolean().default(true),
  send_email: z.boolean().default(false),
  email_template_key: z.enum(['brief_ready', 'keyword_highlights', 'watchlist_digest', 'billing_event', 'system_announcement']).optional(),
  meta: z.record(z.any()).default({}),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const adminUser = await requireAdminUser();

    const body = await request.json();
    const result = CreateNotificationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const notification = await createNotification(result.data, adminUser.id);

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : 'Unable to create notification';
    log.error({ error }, 'Failed to create notification');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
