/**
 * GET /api/notifications/prefs - Get user notification preferences
 * PATCH /api/notifications/prefs - Update user notification preferences
 */

import { NextResponse } from 'next/server';
import { getUserPreferences, updatePreferences } from '@/lib/notifications/preferences';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const log = logger.child({ api: 'notifications/prefs' });

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
    const preferences = await getUserPreferences(userId);
    return NextResponse.json({ preferences });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch preferences';
    log.error({ error, user_id: userId }, 'Failed to fetch preferences');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const UpdatePreferencesSchema = z.object({
  category: z.enum(['keyword', 'watchlist', 'ai', 'account', 'system', 'collab']),
  inapp_enabled: z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  email_frequency: z.enum(['instant', 'daily', 'weekly', 'disabled']).optional(),
});

export async function PATCH(req: Request): Promise<NextResponse> {
  const userId = resolveUserId(req);

  if (!userId) {
    return NextResponse.json(
      { error: 'userId header or query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const result = UpdatePreferencesSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updatedPref = await updatePreferences(userId, result.data);

    return NextResponse.json({
      success: true,
      preference: updatedPref,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update preferences';
    log.error({ error, user_id: userId }, 'Failed to update preferences');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
