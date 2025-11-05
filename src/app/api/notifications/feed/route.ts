/**
 * GET /api/notifications/feed
 * Get notification feed for the authenticated user with pagination
 */

import { NextResponse } from 'next/server';
import { getNotificationFeed, getUnreadCount } from '@/lib/notifications/delivery';
import { logger } from '@/lib/logger';

const log = logger.child({ api: 'notifications/feed' });

function resolveUserId(req: Request): string | null {
  const headerUserId = req.headers.get('x-user-id');
  if (headerUserId) {
    return headerUserId;
  }

  const searchUserId = new URL(req.url).searchParams.get('userId');
  return searchUserId;
}

export async function GET(req: Request): Promise<NextResponse> {
  const userId = resolveUserId(req);

  if (!userId) {
    return NextResponse.json(
      { error: 'userId header or query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const unread = url.searchParams.get('unread') === 'true';

    // Validate pagination params
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters. Page must be >= 1, limit must be 1-100' },
        { status: 400 }
      );
    }

    const feed = await getNotificationFeed(userId, { page, limit, unread });
    const unreadCount = await getUnreadCount(userId);

    return NextResponse.json({
      ...feed,
      unread_count: unreadCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch notification feed';
    log.error({ error, user_id: userId }, 'Failed to fetch notification feed');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
