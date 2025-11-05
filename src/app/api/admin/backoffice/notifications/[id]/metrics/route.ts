/**
 * GET /api/admin/backoffice/notifications/[id]/metrics
 * Get analytics metrics for a notification
 */

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/backoffice/auth';
import { getNotificationMetrics } from '@/lib/notifications/service';
import { getDeliveryRecords } from '@/lib/notifications/delivery';
import { logger } from '@/lib/logger';

const log = logger.child({ api: 'admin/notifications/metrics' });

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireAdminUser();

    const { searchParams } = new URL(request.url);
    const includeRecords = searchParams.get('include_records') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Get metrics
    const metrics = await getNotificationMetrics(params.id);

    // Optionally include delivery records
    let deliveryRecords = null;
    if (includeRecords) {
      deliveryRecords = await getDeliveryRecords(params.id, page, limit);
    }

    return NextResponse.json({
      metrics,
      ...(deliveryRecords && { delivery_records: deliveryRecords }),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : 'Unable to fetch metrics';
    log.error({ error, id: params.id }, 'Failed to fetch metrics');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
