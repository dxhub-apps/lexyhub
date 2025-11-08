"use client";

import { useState, useEffect } from "react";
import { getPostHog } from "@/lib/analytics/posthog";

/**
 * PostHog Debugger Component
 *
 * Drop this component anywhere in your app during development to diagnose
 * PostHog configuration issues.
 *
 * Usage:
 * import { PostHogDebugger } from "@/components/debug/posthog-debugger";
 *
 * // In your component:
 * {process.env.NODE_ENV === "development" && <PostHogDebugger />}
 */
export function PostHogDebugger() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDebugger, setShowDebugger] = useState(false);

  useEffect(() => {
    async function runDiagnostics() {
      try {
        const response = await fetch("/api/debug/posthog");
        const data = await response.json();
        setDiagnostics(data);
      } catch (error) {
        console.error("Failed to fetch diagnostics:", error);
      } finally {
        setLoading(false);
      }
    }

    if (showDebugger) {
      runDiagnostics();
    }
  }, [showDebugger]);

  // Get client-side PostHog info
  const posthog = getPostHog();
  const clientConfig = posthog
    ? {
        initialized: true,
        config: (posthog as any).config,
      }
    : { initialized: false };

  if (!showDebugger) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 9999,
        }}
      >
        <button
          onClick={() => setShowDebugger(true)}
          style={{
            padding: "8px 16px",
            background: "#f59e0b",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "bold",
          }}
        >
          🔍 Debug PostHog
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "white",
        border: "2px solid #e5e7eb",
        borderRadius: "8px",
        padding: "20px",
        maxWidth: "600px",
        maxHeight: "80vh",
        overflow: "auto",
        zIndex: 10000,
        boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>
          PostHog Diagnostics
        </h2>
        <button
          onClick={() => setShowDebugger(false)}
          style={{
            background: "none",
            border: "none",
            fontSize: "20px",
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>

      {loading ? (
        <div>Loading diagnostics...</div>
      ) : (
        <div style={{ fontSize: "14px", fontFamily: "monospace" }}>
          <section style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>
              Server Configuration
            </h3>
            <pre style={{ background: "#f3f4f6", padding: "8px", borderRadius: "4px", overflow: "auto" }}>
              {JSON.stringify(diagnostics?.config, null, 2)}
            </pre>
          </section>

          <section style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>
              Client Configuration
            </h3>
            <pre style={{ background: "#f3f4f6", padding: "8px", borderRadius: "4px", overflow: "auto" }}>
              {JSON.stringify(clientConfig, null, 2)}
            </pre>
          </section>

          <section style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>
              API Key Test
            </h3>
            <pre
              style={{
                background: diagnostics?.apiTest.valid ? "#d1fae5" : "#fee2e2",
                padding: "8px",
                borderRadius: "4px",
                overflow: "auto",
              }}
            >
              {JSON.stringify(diagnostics?.apiTest, null, 2)}
            </pre>
          </section>

          <section style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>
              Troubleshooting Steps
            </h3>
            <div style={{ background: "#fef3c7", padding: "12px", borderRadius: "4px" }}>
              {diagnostics?.troubleshooting.map((step: string, index: number) => (
                <div key={index} style={{ marginBottom: "4px" }}>
                  {step}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>
              Quick Actions
            </h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "6px 12px",
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Hard Reload Page
              </button>
              <button
                onClick={() => {
                  if (posthog) {
                    posthog.capture("$test_event", { source: "debugger" });
                    alert("Test event sent! Check browser network tab for response.");
                  } else {
                    alert("PostHog not initialized");
                  }
                }}
                style={{
                  padding: "6px 12px",
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Send Test Event
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
                  alert("Diagnostics copied to clipboard!");
                }}
                style={{
                  padding: "6px 12px",
                  background: "#6366f1",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Copy Diagnostics
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
