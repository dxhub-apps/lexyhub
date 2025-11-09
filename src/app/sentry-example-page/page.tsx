"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryExamplePage() {
  const [responseMessage, setResponseMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const throwClientError = () => {
    throw new Error("Client-side test error from Sentry example page");
  };

  const captureClientException = () => {
    try {
      throw new Error("Client exception captured manually");
    } catch (error) {
      Sentry.captureException(error, {
        tags: { location: "sentry-example-page", type: "manual" },
      });
      setResponseMessage("✅ Client exception captured and sent to Sentry");
    }
  };

  const sendClientMessage = () => {
    Sentry.captureMessage("Test message from Sentry example page", {
      level: "info",
      tags: { location: "sentry-example-page" },
    });
    setResponseMessage("✅ Client message sent to Sentry");
  };

  const testServerError = async () => {
    setIsLoading(true);
    setResponseMessage("");

    try {
      const response = await fetch("/api/test-sentry?error=1");
      const data = await response.json();

      if (data.success) {
        setResponseMessage(
          `✅ Server error test successful! Event ID: ${data.results[0]?.eventId}`
        );
      } else {
        setResponseMessage(`❌ Server error test failed: ${data.message}`);
      }
    } catch (error) {
      setResponseMessage(`❌ Failed to call test endpoint: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
          <h1 className="text-4xl font-bold mb-2">Sentry Integration Test</h1>
          <p className="text-gray-400 mb-8">
            Use the buttons below to test different Sentry error tracking scenarios
          </p>

          <div className="space-y-6">
            {/* Client-Side Tests */}
            <section>
              <h2 className="text-2xl font-semibold mb-4 text-blue-400">
                Client-Side Tests
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={throwClientError}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Throw Error
                </button>
                <button
                  onClick={captureClientException}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Capture Exception
                </button>
                <button
                  onClick={sendClientMessage}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Send Message
                </button>
              </div>
            </section>

            {/* Server-Side Tests */}
            <section>
              <h2 className="text-2xl font-semibold mb-4 text-green-400">
                Server-Side Tests
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={testServerError}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  {isLoading ? "Testing..." : "Test API Error"}
                </button>
                <button
                  onClick={() => window.location.href = "/api/test-sentry"}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Call Test Endpoint
                </button>
              </div>
            </section>

            {/* Response Message */}
            {responseMessage && (
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mt-6">
                <p className="font-mono text-sm">{responseMessage}</p>
              </div>
            )}

            {/* Instructions */}
            <section className="mt-8 bg-gray-700 rounded-lg p-6 border border-gray-600">
              <h3 className="text-xl font-semibold mb-4">📋 Instructions</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>Click any button above to trigger a test event</li>
                <li>
                  Open your{" "}
                  <a
                    href="https://sentry.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Sentry dashboard
                  </a>
                </li>
                <li>Navigate to Issues to see the captured events</li>
                <li>Events should appear within a few seconds</li>
                <li>Look for events tagged with your test context</li>
              </ol>
            </section>

            {/* Configuration Status */}
            <section className="mt-6 bg-gray-700 rounded-lg p-6 border border-gray-600">
              <h3 className="text-xl font-semibold mb-4">⚙️ Configuration</h3>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">DSN Configured:</span>
                  <span className={process.env.NEXT_PUBLIC_SENTRY_DSN ? "text-green-400" : "text-red-400"}>
                    {process.env.NEXT_PUBLIC_SENTRY_DSN ? "✅ Yes" : "❌ No"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Environment:</span>
                  <span className="text-blue-400">{process.env.NODE_ENV}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
