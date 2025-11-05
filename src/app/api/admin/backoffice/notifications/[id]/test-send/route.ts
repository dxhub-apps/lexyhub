/**
 * POST /api/admin/backoffice/notifications/[id]/test-send
 * Send a test email for a notification
 */

import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/backoffice/auth';
import { getNotification } from '@/lib/notifications/service';
import { sendTestEmail } from '@/lib/notifications/email';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const log = logger.child({ api: 'admin/notifications/test-send' });

const TestSendSchema = z.object({
  test_email: z.string().email(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const adminUser = await requireAdminUser();

    const body = await request.json();
    const result = TestSendSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Get notification
    const notification = await getNotification(params.id);
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Check if email template is configured
    if (!notification.send_email || !notification.email_template_key) {
      return NextResponse.json(
        { error: 'Email is not enabled for this notification or template is missing' },
        { status: 400 }
      );
    }

    // Send test email
    const sendResult = await sendTestEmail(notification, result.data.test_email);

    if (sendResult.success) {
      log.info(
        {
          notification_id: params.id,
          test_email: result.data.test_email,
          message_id: sendResult.messageId,
        },
        'Sent test email'
      );

      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        message_id: sendResult.messageId,
      });
    } else {
      log.error(
        {
          notification_id: params.id,
          test_email: result.data.test_email,
          error: sendResult.error,
        },
        'Failed to send test email'
      );

      return NextResponse.json(
        {
          success: false,
          error: sendResult.error || 'Failed to send test email',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : 'Unable to send test email';
    log.error({ error, id: params.id }, 'Failed to send test email');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
