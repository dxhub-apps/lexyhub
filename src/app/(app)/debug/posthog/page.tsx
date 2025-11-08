"use client";

import { PostHogKeyInspector } from "@/components/debug/posthog-key-inspector";
import { useEffect, useState } from "react";

/**
 * PostHog Debug Page
 *
 * Visit this page to see exactly what API key is in your browser bundle
 * vs what the server has configured.
 *
 * Access: /debug/posthog
 */
export default function PostHogDebugPage() {
  const [serverDiagnostics, setServerDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/debug/posthog")
      .then(res => res.json())
      .then(data => {
        setServerDiagnostics(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch server diagnostics:", err);
        setLoading(false);
      });
  }, []);

  const clientKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const clientHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: "8px" }}>PostHog Configuration Debug</h1>
      <p style={{ color: "#666", marginBottom: "32px" }}>
        This page helps identify why you&apos;re getting 401 errors even though the API key appears correct.
      </p>

      {/* Floating inspector */}
      <PostHogKeyInspector />

      {/* Server vs Client Comparison */}
      <div style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "20px", marginBottom: "16px" }}>🔐 API Key Comparison</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Server Side */}
          <div style={{ border: "2px solid #e5e7eb", borderRadius: "8px", padding: "16px" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#059669" }}>
              ✅ Server Side (from API endpoint)
            </h3>
            {loading ? (
              <div>Loading...</div>
            ) : serverDiagnostics ? (
              <>
                <div style={{ marginBottom: "8px" }}>
                  <strong>Key:</strong>{" "}
                  <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: "4px" }}>
                    {serverDiagnostics.config.keyPreview}
                  </code>
                </div>
                <div style={{ marginBottom: "8px" }}>
                  <strong>Host:</strong>{" "}
                  <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: "4px" }}>
                    {serverDiagnostics.config.host}
                  </code>
                </div>
                <div>
                  <strong>Test Results:</strong>
                  <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                    <li style={{ color: serverDiagnostics.apiTests.batch.valid ? "#059669" : "#dc2626" }}>
                      {serverDiagnostics.apiTests.batch.endpoint}: {serverDiagnostics.apiTests.batch.statusCode}
                    </li>
                    <li style={{ color: serverDiagnostics.apiTests.capture.valid ? "#059669" : "#dc2626" }}>
                      {serverDiagnostics.apiTests.capture.endpoint}: {serverDiagnostics.apiTests.capture.statusCode}
                    </li>
                  </ul>
                </div>
              </>
            ) : (
              <div style={{ color: "#dc2626" }}>Failed to load server diagnostics</div>
            )}
          </div>

          {/* Client Side */}
          <div style={{ border: "2px solid #e5e7eb", borderRadius: "8px", padding: "16px" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#dc2626" }}>
              ❓ Client Side (from browser bundle)
            </h3>
            <div style={{ marginBottom: "8px" }}>
              <strong>Key:</strong>{" "}
              <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: "4px" }}>
                {clientKey ? `${clientKey.substring(0, 8)}...${clientKey.substring(clientKey.length - 4)}` : "NOT SET"}
              </code>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <strong>Host:</strong>{" "}
              <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: "4px" }}>
                {clientHost || "NOT SET"}
              </code>
            </div>
            <div style={{ marginTop: "12px", padding: "8px", background: "#fef3c7", borderRadius: "4px", fontSize: "14px" }}>
              ⚠️ These values are baked into the JavaScript bundle at BUILD time.
              If they don&apos;t match the server, you have a stale build.
            </div>
          </div>
        </div>

        {/* Comparison Result */}
        {!loading && serverDiagnostics && clientKey && (
          <div style={{
            marginTop: "16px",
            padding: "16px",
            borderRadius: "8px",
            background: serverDiagnostics.config.keyPreview === `${clientKey.substring(0, 8)}...${clientKey.substring(clientKey.length - 4)}`
              ? "#d1fae5"
              : "#fee2e2",
            border: serverDiagnostics.config.keyPreview === `${clientKey.substring(0, 8)}...${clientKey.substring(clientKey.length - 4)}`
              ? "2px solid #059669"
              : "2px solid #dc2626",
          }}>
            {serverDiagnostics.config.keyPreview === `${clientKey.substring(0, 8)}...${clientKey.substring(clientKey.length - 4)}` ? (
              <>
                <strong style={{ color: "#059669" }}>✅ Server and Client keys match!</strong>
                <p style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
                  The build picked up the correct environment variables.
                  If you&apos;re still seeing 401 errors, the issue is something else.
                </p>
              </>
            ) : (
              <>
                <strong style={{ color: "#dc2626" }}>❌ MISMATCH! Server and Client have DIFFERENT keys!</strong>
                <p style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
                  This is the root cause of your 401 errors! The JavaScript bundle
                  was built with an old/wrong API key.
                </p>
                <div style={{ marginTop: "12px", padding: "12px", background: "white", borderRadius: "4px" }}>
                  <strong>How to fix:</strong>
                  <ol style={{ margin: "8px 0 0 0", paddingLeft: "20px", fontSize: "14px" }}>
                    <li>Trigger a new build in Vercel (don&apos;t just redeploy)</li>
                    <li>Make a dummy code change and push to git</li>
                    <li>Or use Vercel CLI: <code>vercel --force</code></li>
                  </ol>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
        <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>📋 What to do:</h2>
        <ol style={{ paddingLeft: "20px", lineHeight: "1.8" }}>
          <li>Check the floating inspector (top-right corner)</li>
          <li>Look at the &quot;API Key Comparison&quot; above</li>
          <li>Open browser DevTools → Console to see full key values</li>
          <li>Open browser DevTools → Network tab</li>
          <li>Filter for &quot;posthog&quot; in the Network tab</li>
          <li>Look at a failing request to <code>/i/v0/e/</code></li>
          <li>Check the request payload - what API key is being sent?</li>
          <li>Compare it with the server key from the diagnostics above</li>
        </ol>
      </div>

      {/* Quick Actions */}
      <div style={{ marginTop: "32px" }}>
        <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>🚀 Quick Actions</h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            Hard Reload Page
          </button>
          <button
            onClick={() => {
              const info = {
                server: serverDiagnostics,
                client: {
                  key: clientKey,
                  host: clientHost,
                  allEnvVars: process.env,
                }
              };
              navigator.clipboard.writeText(JSON.stringify(info, null, 2));
              alert("Full diagnostic info copied!");
            }}
            style={{
              padding: "10px 20px",
              background: "#6366f1",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            Copy All Diagnostics
          </button>
          <button
            onClick={() => {
              // @ts-ignore
              if (window.posthog) {
                // @ts-ignore
                window.posthog.capture("debug_test_event", { source: "debug_page" });
                alert("Test event sent! Check Network tab for the request.");
              } else {
                alert("PostHog not initialized yet");
              }
            }}
            style={{
              padding: "10px 20px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            Send Test Event
          </button>
        </div>
      </div>
    </div>
  );
}
