"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { trackAnalyticsEvent, AnalyticsEvents } from "@/lib/analytics/tracking";
import { getPostHog, isPostHogReady } from "@/lib/analytics/posthog";
import { Button } from "@/components/ui/button";

export default function MonitoringStatusPage() {
  const [sentryConfigured, setSentryConfigured] = useState(false);
  const [posthogConfigured, setPosthogConfigured] = useState(false);
  const [posthogReady, setPosthogReady] = useState(false);
  const [testResults, setTestResults] = useState<{
    sentry?: string;
    posthog?: string;
  }>({});

  useEffect(() => {
    // Check configuration status
    setSentryConfigured(!!process.env.NEXT_PUBLIC_SENTRY_DSN);
    setPosthogConfigured(!!process.env.NEXT_PUBLIC_POSTHOG_KEY);
    setPosthogReady(isPostHogReady());
  }, []);

  const testSentry = () => {
    try {
      // Test Sentry by capturing a test message
      Sentry.captureMessage("Test message from monitoring page", {
        level: "info",
        tags: { test: true },
      });

      // Also test error capture
      const testError = new Error("Test error from monitoring page");
      Sentry.captureException(testError, {
        level: "warning",
        tags: { test: true },
      });

      setTestResults((prev) => ({
        ...prev,
        sentry: "✅ Test events sent successfully! Check your Sentry dashboard.",
      }));
    } catch (error) {
      setTestResults((prev) => ({
        ...prev,
        sentry: `❌ Failed to send test event: ${error}`,
      }));
    }
  };

  const testPostHog = () => {
    try {
      const posthog = getPostHog();

      if (!posthog || !isPostHogReady()) {
        setTestResults((prev) => ({
          ...prev,
          posthog: "❌ PostHog is not initialized. Check your configuration.",
        }));
        return;
      }

      // Test PostHog by capturing a test event
      trackAnalyticsEvent("test_event", {
        source: "monitoring_page",
        timestamp: new Date().toISOString(),
        test: true,
      });

      // Test page view
      posthog.capture("$pageview", {
        $current_url: window.location.href,
        test: true,
      });

      setTestResults((prev) => ({
        ...prev,
        posthog: "✅ Test events sent successfully! Check your PostHog dashboard.",
      }));
    } catch (error) {
      setTestResults((prev) => ({
        ...prev,
        posthog: `❌ Failed to send test event: ${error}`,
      }));
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Monitoring Status</h1>

      <div className="space-y-6">
        {/* Sentry Status */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Sentry Error Tracking</h2>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                sentryConfigured
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {sentryConfigured ? "✅ Configured" : "❌ Not Configured"}
            </span>
          </div>

          {sentryConfigured ? (
            <div className="space-y-4">
              <p className="text-gray-600">
                Sentry is configured and ready to capture errors and performance data.
              </p>
              <Button onClick={testSentry} variant="outline">
                Send Test Event
              </Button>
              {testResults.sentry && (
                <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                  {testResults.sentry}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-600">
                Sentry is not configured. Error tracking is disabled.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm">
                <p className="font-semibold mb-2">To enable Sentry:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Get your DSN from <a href="https://sentry.io/settings/projects/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Sentry Settings</a></li>
                  <li>Add to your <code className="bg-gray-100 px-1 rounded">.env.local</code> file:</li>
                </ol>
                <pre className="mt-2 bg-gray-100 p-2 rounded text-xs">
                  NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* PostHog Status */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">PostHog Analytics</h2>
            <div className="flex gap-2">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  posthogConfigured
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {posthogConfigured ? "✅ Configured" : "❌ Not Configured"}
              </span>
              {posthogConfigured && (
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    posthogReady
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {posthogReady ? "✅ Ready" : "⏳ Initializing"}
                </span>
              )}
            </div>
          </div>

          {posthogConfigured ? (
            <div className="space-y-4">
              <p className="text-gray-600">
                PostHog is configured and ready to capture analytics events and user behavior.
              </p>
              <Button onClick={testPostHog} variant="outline" disabled={!posthogReady}>
                Send Test Event
              </Button>
              {testResults.posthog && (
                <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                  {testResults.posthog}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-600">
                PostHog is not configured. Analytics tracking is disabled.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm">
                <p className="font-semibold mb-2">To enable PostHog:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Get your API key from <a href="https://app.posthog.com/project/settings" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">PostHog Settings</a></li>
                  <li>Add to your <code className="bg-gray-100 px-1 rounded">.env.local</code> file:</li>
                </ol>
                <pre className="mt-2 bg-gray-100 p-2 rounded text-xs">
                  NEXT_PUBLIC_POSTHOG_KEY=phc_...{"\n"}
                  NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Quick Setup Guide */}
        <div className="border rounded-lg p-6 bg-blue-50 border-blue-200">
          <h2 className="text-xl font-semibold mb-4">Quick Setup Guide</h2>
          <div className="space-y-3 text-sm">
            <p>
              To get both monitoring services working, create a <code className="bg-white px-1 rounded">.env.local</code> file in your project root with:
            </p>
            <pre className="bg-white p-4 rounded border overflow-x-auto">
{`# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/your-project-id
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token

# PostHog Configuration
NEXT_PUBLIC_POSTHOG_KEY=phc_your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com`}
            </pre>
            <p className="text-gray-600">
              After adding these variables, restart your development server for changes to take effect.
            </p>
          </div>
        </div>

        {/* Environment Variables Check */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                NEXT_PUBLIC_SENTRY_DSN
              </span>
              <span className={sentryConfigured ? "text-green-600" : "text-red-600"}>
                {sentryConfigured ? "✓ Set" : "✗ Not Set"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                NEXT_PUBLIC_POSTHOG_KEY
              </span>
              <span className={posthogConfigured ? "text-green-600" : "text-red-600"}>
                {posthogConfigured ? "✓ Set" : "✗ Not Set"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
