"use client";

import { useEffect, useState } from "react";

/**
 * PostHog Key Inspector
 *
 * This component reveals EXACTLY what API key is embedded in the browser bundle.
 * If this doesn't match your Vercel env var, that's your problem!
 */
export function PostHogKeyInspector() {
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    // Get the key from the environment (baked into bundle at build time)
    const clientKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const clientHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    // Try to get the PostHog instance if it's initialized
    let posthogKey = null;
    let posthogHost = null;

    try {
      // @ts-ignore - accessing global posthog
      if (window.posthog && window.posthog.config) {
        // @ts-ignore
        posthogKey = window.posthog.config.token;
        // @ts-ignore
        posthogHost = window.posthog.config.api_host;
      }
    } catch (e) {
      // Ignore errors
    }

    setInfo({
      fromEnv: {
        key: clientKey ? `${clientKey.substring(0, 8)}...${clientKey.substring(clientKey.length - 4)}` : "NOT SET",
        keyFull: clientKey, // Will show in console
        host: clientHost || "NOT SET",
      },
      fromPostHogInstance: {
        key: posthogKey ? `${posthogKey.substring(0, 8)}...${posthogKey.substring(posthogKey.length - 4)}` : "NOT INITIALIZED",
        keyFull: posthogKey,
        host: posthogHost || "NOT INITIALIZED",
      },
      buildTime: {
        // These are baked in at build time
        nodeEnv: process.env.NODE_ENV,
        nextPublicKeys: Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_')),
      }
    });

  }, []);

  if (!info) {
    return <div style={{ padding: "20px" }}>Loading...</div>;
  }

  const keysMatch = info.fromEnv.keyFull === info.fromPostHogInstance.keyFull;

  return (
    <div style={{
      position: "fixed",
      top: "10px",
      right: "10px",
      background: "white",
      border: "3px solid " + (keysMatch ? "#10b981" : "#ef4444"),
      borderRadius: "8px",
      padding: "16px",
      maxWidth: "400px",
      fontSize: "12px",
      fontFamily: "monospace",
      zIndex: 99999,
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    }}>
      <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "bold" }}>
        🔍 PostHog Key Inspector
      </h3>

      <div style={{ marginBottom: "12px" }}>
        <strong>From Environment (Build Time):</strong>
        <div style={{ background: "#f3f4f6", padding: "8px", marginTop: "4px", borderRadius: "4px" }}>
          <div>Key: {info.fromEnv.key}</div>
          <div>Host: {info.fromEnv.host}</div>
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <strong>From PostHog Instance (Runtime):</strong>
        <div style={{ background: "#f3f4f6", padding: "8px", marginTop: "4px", borderRadius: "4px" }}>
          <div>Key: {info.fromPostHogInstance.key}</div>
          <div>Host: {info.fromPostHogInstance.host}</div>
        </div>
      </div>

      <div style={{
        background: keysMatch ? "#d1fae5" : "#fee2e2",
        padding: "8px",
        borderRadius: "4px",
        marginTop: "12px",
      }}>
        {keysMatch ? (
          <div>
            <strong>✅ Keys Match!</strong>
            <div style={{ marginTop: "4px", fontSize: "11px" }}>
              The bundle has the correct key. If you&apos;re still seeing 401 errors,
              check the browser Network tab to see what&apos;s actually being sent.
            </div>
          </div>
        ) : (
          <div>
            <strong>❌ KEYS DON&apos;T MATCH!</strong>
            <div style={{ marginTop: "4px", fontSize: "11px" }}>
              The JavaScript bundle has a different key than PostHog is using.
              This is likely a stale build cache issue.
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: "12px", fontSize: "10px", color: "#666" }}>
        Check browser console for full key values
      </div>

      <button
        onClick={() => {
          const fullInfo = {
            ...info,
            buildEnvVars: process.env,
          };
          navigator.clipboard.writeText(JSON.stringify(fullInfo, null, 2));
          alert("Full diagnostic info copied to clipboard!");
        }}
        style={{
          marginTop: "8px",
          padding: "6px 12px",
          background: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "11px",
          width: "100%",
        }}
      >
        Copy Full Info
      </button>
    </div>
  );
}
