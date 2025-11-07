/**
 * LexyBrain Notification Integration
 *
 * Creates notifications for high-severity RiskSentinel outputs.
 * Integrates with the existing notification system (migration 0029).
 */

import { getSupabaseServerClient } from "./supabase-server";
import { isLexyBrainNotificationsEnabled } from "./lexybrain-config";
import { logger } from "./logger";
import * as Sentry from "@sentry/nextjs";

// =====================================================
// Types
// =====================================================

export interface RiskSentinelAlert {
  term: string;
  issue: string;
  severity: "low" | "medium" | "high";
  evidence: string;
  action: string;
}

export interface NotificationResult {
  created: boolean;
  notificationId?: string;
  reason?: string;
}

// =====================================================
// Notification Creation
// =====================================================

/**
 * Create notification for high-severity RiskSentinel output
 *
 * @param userId - User ID to notify
 * @param market - Market (etsy, amazon, etc.)
 * @param nicheTerms - Niche keywords analyzed
 * @param alerts - Array of risk alerts from RiskSentinel
 * @returns Result indicating if notification was created
 */
export async function createRiskSentinelNotification(
  userId: string,
  market: string,
  nicheTerms: string[],
  alerts: RiskSentinelAlert[]
): Promise<NotificationResult> {
  // 1. Feature flag check
  if (!isLexyBrainNotificationsEnabled()) {
    return {
      created: false,
      reason: "notifications_disabled",
    };
  }

  // 2. Filter for high severity alerts only
  const highSeverityAlerts = alerts.filter((alert) => alert.severity === "high");

  if (highSeverityAlerts.length === 0) {
    return {
      created: false,
      reason: "no_high_severity_alerts",
    };
  }

  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      throw new Error("Supabase client unavailable");
    }

    // 3. Check user notification preferences
    const { data: userPrefs } = await supabase
      .from("user_notification_prefs")
      .select("inapp_enabled, email_enabled, email_frequency")
      .eq("user_id", userId)
      .eq("category", "ai")
      .single();

    // Default to enabled if no preferences exist (will be created by trigger)
    const inappEnabled = userPrefs?.inapp_enabled ?? true;
    const emailEnabled = userPrefs?.email_enabled ?? true;

    if (!inappEnabled && !emailEnabled) {
      return {
        created: false,
        reason: "user_disabled_ai_notifications",
      };
    }

    // 4. Build notification content
    const highCount = highSeverityAlerts.length;
    const niche = nicheTerms.join(", ");
    const severityLabel = "High Risk";

    const title = `${severityLabel} Alert: ${niche}`;
    const body = buildNotificationBody(
      market,
      nicheTerms,
      highSeverityAlerts
    );

    // All high-severity alerts get "critical" notification severity
    const notificationSeverity: "warning" | "critical" = "critical";

    // 5. Create notification record
    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .insert({
        kind: emailEnabled ? "mixed" : "inapp",
        source: "system",
        category: "ai",
        title,
        body,
        cta_text: "View Details",
        cta_url: `/insights?tab=generate&type=risk&market=${market}&keywords=${encodeURIComponent(niche)}`,
        severity: notificationSeverity,
        priority: 10, // High severity = high priority
        create_inapp: inappEnabled,
        show_banner: false, // Don't show as banner (just in-app notification)
        status: "live",
        icon: "alert-triangle",
      })
      .select("id")
      .single();

    if (notificationError || !notification) {
      throw notificationError || new Error("Failed to create notification");
    }

    // 6. Create delivery record for the user
    const channels: string[] = [];
    if (inappEnabled) channels.push("inapp");
    if (emailEnabled) channels.push("email");

    const { error: deliveryError } = await supabase
      .from("notification_delivery")
      .insert({
        notification_id: notification.id,
        user_id: userId,
        channels,
        state: "pending",
      });

    if (deliveryError) {
      logger.warn(
        {
          type: "lexybrain_notification_delivery_error",
          user_id: userId,
          notification_id: notification.id,
          error: deliveryError.message,
        },
        "Failed to create notification delivery record"
      );
      // Don't throw - notification was created successfully
    }

    logger.info(
      {
        type: "lexybrain_notification_created",
        user_id: userId,
        notification_id: notification.id,
        market,
        niche,
        severity: notificationSeverity,
        alerts_count: highSeverityAlerts.length,
        channels,
      },
      "Created RiskSentinel notification"
    );

    return {
      created: true,
      notificationId: notification.id,
    };
  } catch (error) {
    logger.error(
      {
        type: "lexybrain_notification_error",
        user_id: userId,
        market,
        niche: nicheTerms.join(", "),
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to create RiskSentinel notification"
    );

    Sentry.captureException(error, {
      tags: {
        feature: "lexybrain",
        component: "notifications",
      },
      extra: {
        user_id: userId,
        market,
        niche_terms: nicheTerms,
        alerts_count: highSeverityAlerts.length,
      },
    });

    return {
      created: false,
      reason: "error",
    };
  }
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Build notification body text from alerts
 */
function buildNotificationBody(
  market: string,
  nicheTerms: string[],
  alerts: RiskSentinelAlert[]
): string {
  const niche = nicheTerms.join(", ");
  const lines: string[] = [
    `LexyBrain detected ${alerts.length} high-severity risk${alerts.length > 1 ? "s" : ""} in your analysis of "${niche}" on ${market}.`,
    "",
    "**Key Risks:**",
  ];

  // Add top 3 alerts
  const topAlerts = alerts.slice(0, 3);
  for (const alert of topAlerts) {
    lines.push(`• **${alert.term}**: ${alert.issue}`);
  }

  if (alerts.length > 3) {
    lines.push(`• ...and ${alerts.length - 3} more`);
  }

  lines.push("");
  lines.push("Click to view full risk analysis and recommendations.");

  return lines.join("\n");
}
