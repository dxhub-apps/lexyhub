/**
 * GET /api/notifications/active
 * Get active banner notification for the authenticated user
 */

import { NextResponse } from 'next/server';
import { getActiveBanner } from '@/lib/notifications/delivery';
import { logger } from '@/lib/logger';

const log = logger.child({ api: 'notifications/active' });

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
    const banner = await getActiveBanner(userId);

    if (!banner) {
      return NextResponse.json({ banner: null });
    }

    return NextResponse.json({ banner });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch active banner';
    log.error({ error, user_id: userId }, 'Failed to fetch active banner');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
