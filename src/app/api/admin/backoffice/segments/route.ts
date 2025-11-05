/**
 * Admin API for notification segments
 * GET - List all segments
 * POST - Create new segment
 */

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/backoffice/auth';
import { listSegments, createSegment } from '@/lib/notifications/service';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const log = logger.child({ api: 'admin/segments' });

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdminUser();

    const segments = await listSegments();

    return NextResponse.json({ segments });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : 'Unable to list segments';
    log.error({ error }, 'Failed to list segments');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const CreateSegmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  filters: z.record(z.any()),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const adminUser = await requireAdminUser();

    const body = await request.json();
    const result = CreateSegmentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const segment = await createSegment(
      result.data.name,
      result.data.description || '',
      result.data.filters,
      adminUser.user.id
    );

    return NextResponse.json({ segment }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : 'Unable to create segment';
    log.error({ error }, 'Failed to create segment');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
