/**
 * Email notification service - Resend integration
 *
 * NOTE: Requires `resend` package to be installed:
 * npm install resend
 *
 * Environment variables required:
 * - RESEND_API_KEY: Resend API key
 * - RESEND_FROM_EMAIL: Default sender email (e.g., notifications@lexyhub.com)
 */

import { logger } from '@/lib/logger';
import type {
  Notification,
  EmailContext,
  EmailTemplate,
  EmailTemplateKey,
} from './types';

const log = logger.child({ module: 'notifications/email' });

// Lazy-load Resend to avoid import errors if not installed
let Resend: any;
let resendClient: any;

function getResendClient() {
  if (!resendClient) {
    try {
      // Dynamic import to handle case where resend is not installed
      const ResendLib = require('resend');
      Resend = ResendLib.Resend;

      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error('RESEND_API_KEY environment variable is not set');
      }

      resendClient = new Resend(apiKey);
      log.info('Resend client initialized');
    } catch (error) {
      log.error({ error }, 'Failed to initialize Resend client - ensure resend package is installed');
      throw new Error('Resend is not configured. Install with: npm install resend');
    }
  }
  return resendClient;
}

const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'notifications@lexyhub.com';
const DEFAULT_FROM_NAME = 'LexyHub';

/**
 * Send a notification email
 */
export async function sendNotificationEmail(
  notification: Notification,
  recipients: Array<{ email: string; userId: string; name?: string }>
): Promise<Array<{ userId: string; messageId?: string; error?: string }>> {
  if (recipients.length === 0) {
    log.warn({ notification_id: notification.id }, 'No recipients for email notification');
    return [];
  }

  const template = getEmailTemplate(notification.email_template_key);
  if (!template) {
    log.error(
      { notification_id: notification.id, template_key: notification.email_template_key },
      'Email template not found'
    );
    return recipients.map((r) => ({
      userId: r.userId,
      error: 'Template not found',
    }));
  }

  const resend = getResendClient();
  const results: Array<{ userId: string; messageId?: string; error?: string }> = [];

  // Send emails (could be batched for performance)
  for (const recipient of recipients) {
    try {
      const context: EmailContext = {
        user: {
          id: recipient.userId,
          email: recipient.email,
          name: recipient.name,
        },
        notification,
        preferences_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lexyhub.com'}/settings/notifications`,
        unsubscribe_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lexyhub.com'}/settings/notifications?category=${notification.category}`,
      };

      const html = template.render(context);
      const subject = template.subject.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        if (key === 'title') return notification.title;
        return '';
      });

      const { data, error } = await resend.emails.send({
        from: `${template.from_name} <${template.from_email}>`,
        to: recipient.email,
        subject,
        html,
        tags: [
          { name: 'notification_id', value: notification.id },
          { name: 'category', value: notification.category },
          { name: 'template', value: notification.email_template_key || 'unknown' },
        ],
      });

      if (error) {
        log.error(
          { error, notification_id: notification.id, recipient: recipient.email },
          'Failed to send email'
        );
        results.push({
          userId: recipient.userId,
          error: error.message || 'Unknown error',
        });
      } else {
        log.info(
          { notification_id: notification.id, recipient: recipient.email, message_id: data?.id },
          'Sent notification email'
        );
        results.push({
          userId: recipient.userId,
          messageId: data?.id,
        });
      }

      // Rate limiting: small delay between emails
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error: any) {
      log.error(
        { error, notification_id: notification.id, recipient: recipient.email },
        'Exception sending email'
      );
      results.push({
        userId: recipient.userId,
        error: error.message || 'Exception occurred',
      });
    }
  }

  return results;
}

/**
 * Send a test email
 */
export async function sendTestEmail(
  notification: Notification,
  testEmail: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const results = await sendNotificationEmail(notification, [
      { email: testEmail, userId: 'test', name: 'Test User' },
    ]);

    if (results.length > 0 && results[0].messageId) {
      return {
        success: true,
        messageId: results[0].messageId,
      };
    } else {
      return {
        success: false,
        error: results[0]?.error || 'Unknown error',
      };
    }
  } catch (error: any) {
    log.error({ error, test_email: testEmail }, 'Failed to send test email');
    return {
      success: false,
      error: error.message || 'Exception occurred',
    };
  }
}

/**
 * Get email template by key
 */
function getEmailTemplate(key?: EmailTemplateKey): EmailTemplate | null {
  if (!key) return null;

  const templates: Record<EmailTemplateKey, EmailTemplate> = {
    brief_ready: briefReadyTemplate,
    keyword_highlights: keywordHighlightsTemplate,
    watchlist_digest: watchlistDigestTemplate,
    billing_event: billingEventTemplate,
    system_announcement: systemAnnouncementTemplate,
  };

  return templates[key] || null;
}

// ===========================
// EMAIL TEMPLATES
// ===========================

const briefReadyTemplate: EmailTemplate = {
  key: 'brief_ready',
  subject: '{{title}}',
  from_name: DEFAULT_FROM_NAME,
  from_email: DEFAULT_FROM_EMAIL,
  render: (context: EmailContext) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${context.notification.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #1a1a1a;">${context.notification.title}</h1>
    ${context.notification.body ? `<p style="margin: 0 0 16px 0; color: #666;">${context.notification.body}</p>` : ''}
    ${
      context.notification.cta_text && context.notification.cta_url
        ? `
      <a href="${context.notification.cta_url}" style="display: inline-block; background-color: #0066ff; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 8px;">
        ${context.notification.cta_text}
      </a>
    `
        : ''
    }
  </div>

  <div style="border-top: 1px solid #e1e4e8; padding-top: 16px; margin-top: 24px; font-size: 14px; color: #666;">
    <p style="margin: 0 0 8px 0;">
      <a href="${context.preferences_url}" style="color: #0066ff; text-decoration: none;">Manage notification preferences</a>
    </p>
    <p style="margin: 0; color: #999;">
      © ${new Date().getFullYear()} LexyHub. All rights reserved.
    </p>
  </div>
</body>
</html>
  `,
};

const keywordHighlightsTemplate: EmailTemplate = {
  key: 'keyword_highlights',
  subject: 'Daily Keyword Highlights - {{title}}',
  from_name: DEFAULT_FROM_NAME,
  from_email: DEFAULT_FROM_EMAIL,
  render: (context: EmailContext) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${context.notification.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="margin: 0 0 8px 0; font-size: 24px;">📊 ${context.notification.title}</h1>
    <p style="margin: 0; opacity: 0.9;">Your daily keyword intelligence digest</p>
  </div>

  <div style="background-color: #fff; border: 1px solid #e1e4e8; border-radius: 8px; padding: 24px; margin-bottom: 16px;">
    ${context.notification.body ? `<div style="color: #666;">${context.notification.body}</div>` : ''}
    ${
      context.notification.cta_text && context.notification.cta_url
        ? `
      <a href="${context.notification.cta_url}" style="display: inline-block; background-color: #667eea; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 16px;">
        ${context.notification.cta_text}
      </a>
    `
        : ''
    }
  </div>

  <div style="border-top: 1px solid #e1e4e8; padding-top: 16px; margin-top: 24px; font-size: 14px; color: #666;">
    <p style="margin: 0 0 8px 0;">
      <a href="${context.preferences_url}" style="color: #667eea; text-decoration: none;">Manage notification preferences</a>
    </p>
    <p style="margin: 0; color: #999;">
      © ${new Date().getFullYear()} LexyHub. All rights reserved.
    </p>
  </div>
</body>
</html>
  `,
};

const watchlistDigestTemplate: EmailTemplate = {
  key: 'watchlist_digest',
  subject: 'Weekly Watchlist Digest - {{title}}',
  from_name: DEFAULT_FROM_NAME,
  from_email: DEFAULT_FROM_EMAIL,
  render: (context: EmailContext) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${context.notification.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="margin: 0 0 8px 0; font-size: 24px;">👀 ${context.notification.title}</h1>
    <p style="margin: 0; opacity: 0.9;">Your weekly watchlist updates</p>
  </div>

  <div style="background-color: #fff; border: 1px solid #e1e4e8; border-radius: 8px; padding: 24px; margin-bottom: 16px;">
    ${context.notification.body ? `<div style="color: #666;">${context.notification.body}</div>` : ''}
    ${
      context.notification.cta_text && context.notification.cta_url
        ? `
      <a href="${context.notification.cta_url}" style="display: inline-block; background-color: #f5576c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 16px;">
        ${context.notification.cta_text}
      </a>
    `
        : ''
    }
  </div>

  <div style="border-top: 1px solid #e1e4e8; padding-top: 16px; margin-top: 24px; font-size: 14px; color: #666;">
    <p style="margin: 0 0 8px 0;">
      <a href="${context.preferences_url}" style="color: #f5576c; text-decoration: none;">Manage notification preferences</a>
    </p>
    <p style="margin: 0; color: #999;">
      © ${new Date().getFullYear()} LexyHub. All rights reserved.
    </p>
  </div>
</body>
</html>
  `,
};

const billingEventTemplate: EmailTemplate = {
  key: 'billing_event',
  subject: '{{title}}',
  from_name: DEFAULT_FROM_NAME,
  from_email: DEFAULT_FROM_EMAIL,
  render: (context: EmailContext) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${context.notification.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f0f9ff; border-left: 4px solid #0066ff; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #1a1a1a;">💳 ${context.notification.title}</h1>
    ${context.notification.body ? `<p style="margin: 0 0 16px 0; color: #666;">${context.notification.body}</p>` : ''}
    ${
      context.notification.cta_text && context.notification.cta_url
        ? `
      <a href="${context.notification.cta_url}" style="display: inline-block; background-color: #0066ff; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 8px;">
        ${context.notification.cta_text}
      </a>
    `
        : ''
    }
  </div>

  <div style="background-color: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <p style="margin: 0; color: #92400e; font-size: 14px;">
      <strong>Important:</strong> This is a transactional email regarding your Lexyhub account. You cannot unsubscribe from billing notifications.
    </p>
  </div>

  <div style="border-top: 1px solid #e1e4e8; padding-top: 16px; margin-top: 24px; font-size: 14px; color: #666;">
    <p style="margin: 0 0 8px 0;">
      Questions? Contact us at <a href="mailto:support@lexyhub.com" style="color: #0066ff; text-decoration: none;">support@lexyhub.com</a>
    </p>
    <p style="margin: 0; color: #999;">
      © ${new Date().getFullYear()} LexyHub. All rights reserved.
    </p>
  </div>
</body>
</html>
  `,
};

const systemAnnouncementTemplate: EmailTemplate = {
  key: 'system_announcement',
  subject: '[Lexyhub] {{title}}',
  from_name: DEFAULT_FROM_NAME,
  from_email: DEFAULT_FROM_EMAIL,
  render: (context: EmailContext) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${context.notification.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: ${context.notification.severity === 'critical' ? '#fee2e2' : context.notification.severity === 'warning' ? '#fef3c7' : '#f0f9ff'}; border-left: 4px solid ${context.notification.severity === 'critical' ? '#dc2626' : context.notification.severity === 'warning' ? '#f59e0b' : '#0066ff'}; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #1a1a1a;">${context.notification.icon || '📢'} ${context.notification.title}</h1>
    ${context.notification.body ? `<div style="margin: 0 0 16px 0; color: #666;">${context.notification.body}</div>` : ''}
    ${
      context.notification.cta_text && context.notification.cta_url
        ? `
      <a href="${context.notification.cta_url}" style="display: inline-block; background-color: #0066ff; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 8px;">
        ${context.notification.cta_text}
      </a>
    `
        : ''
    }
  </div>

  <div style="border-top: 1px solid #e1e4e8; padding-top: 16px; margin-top: 24px; font-size: 14px; color: #666;">
    <p style="margin: 0 0 8px 0;">
      <a href="${context.preferences_url}" style="color: #0066ff; text-decoration: none;">Manage notification preferences</a>
    </p>
    <p style="margin: 0; color: #999;">
      © ${new Date().getFullYear()} LexyHub. All rights reserved.
    </p>
  </div>
</body>
</html>
  `,
};

/**
 * Handle Resend webhooks (for email opens, clicks, bounces)
 */
export async function handleResendWebhook(
  event: any
): Promise<{ notification_id?: string; user_id?: string; status?: any }> {
  const { type, data } = event;

  // Extract notification_id and user_id from tags
  const notificationId = data?.tags?.find((t: any) => t.name === 'notification_id')?.value;
  const userId = data?.to; // This would be the email, need to map to user_id

  if (!notificationId) {
    log.warn({ event_type: type }, 'Webhook event missing notification_id tag');
    return {};
  }

  log.info({ event_type: type, notification_id: notificationId }, 'Received Resend webhook');

  return {
    notification_id: notificationId,
    user_id: userId,
    status: {
      type,
      data,
    },
  };
}
