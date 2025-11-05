// extension/src/background/index.ts
/**
 * Background service worker (MV3)
 * Handles:
 * - Authentication state
 * - API request batching and caching
 * - Remote config and kill-switch
 * - Message passing with content scripts
 */

import { StorageManager } from "../lib/storage";
import { AuthManager } from "../lib/auth";
import { APIClient } from "../lib/api-client";
import { RemoteConfig } from "../lib/remote-config";

// Initialize managers
const storage = new StorageManager();
const auth = new AuthManager(storage);
const api = new APIClient(auth);
const remoteConfig = new RemoteConfig(storage);

// Install handler
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("[LexyHub] Extension installed/updated", details.reason);

  if (details.reason === "install") {
    // Open welcome page
    await chrome.tabs.create({
      url: "https://lexyhub.com/ext/welcome",
    });

    // Initialize default settings
    await storage.set("settings", {
      enabled_domains: {
        etsy: true,
        amazon: true,
        shopify: true,
        google: false,
        pinterest: false,
        reddit: false,
      },
      highlight_enabled: true,
      tooltip_enabled: true,
      capture_enabled: true,
    });
  }

  // Fetch remote config
  await remoteConfig.fetch();
});

// Startup handler
chrome.runtime.onStartup.addListener(async () => {
  console.log("[LexyHub] Extension started");

  // Fetch remote config
  await remoteConfig.fetch();

  // Check auth state
  const isAuthenticated = await auth.isAuthenticated();
  console.log("[LexyHub] Auth state:", isAuthenticated);
});

// Message handler from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[LexyHub] Message received:", message.type);

  switch (message.type) {
    case "GET_AUTH_STATE":
      handleGetAuthState(sendResponse);
      return true; // Keep channel open for async response

    case "INITIATE_LOGIN":
      handleInitiateLogin(sendResponse);
      return true;

    case "LOGOUT":
      handleLogout(sendResponse);
      return true;

    case "GET_WATCHLIST":
      handleGetWatchlist(message.payload, sendResponse);
      return true;

    case "ADD_TO_WATCHLIST":
      handleAddToWatchlist(message.payload, sendResponse);
      return true;

    case "GET_METRICS":
      handleGetMetrics(message.payload, sendResponse);
      return true;

    case "CREATE_BRIEF":
      handleCreateBrief(message.payload, sendResponse);
      return true;

    case "CAPTURE_EVENT":
      handleCaptureEvent(message.payload, sendResponse);
      return true;

    case "GET_SETTINGS":
      handleGetSettings(sendResponse);
      return true;

    case "UPDATE_SETTINGS":
      handleUpdateSettings(message.payload, sendResponse);
      return true;

    case "SAVE_SESSION":
      handleSaveSession(message.payload, sendResponse);
      return true;

    default:
      console.warn("[LexyHub] Unknown message type:", message.type);
      sendResponse({ error: "Unknown message type" });
      return false;
  }
});

// Handler implementations
async function handleGetAuthState(sendResponse: (response: any) => void) {
  try {
    const isAuthenticated = await auth.isAuthenticated();
    const token = await auth.getToken();

    sendResponse({
      isAuthenticated,
      hasToken: !!token,
    });
  } catch (error) {
    console.error("[LexyHub] Error getting auth state:", error);
    sendResponse({ isAuthenticated: false, hasToken: false });
  }
}

async function handleInitiateLogin(sendResponse: (response: any) => void) {
  try {
    await auth.initiateLogin();
    sendResponse({ success: true });
  } catch (error) {
    console.error("[LexyHub] Error initiating login:", error);
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleLogout(sendResponse: (response: any) => void) {
  try {
    await auth.logout();
    sendResponse({ success: true });
  } catch (error) {
    console.error("[LexyHub] Error during logout:", error);
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleGetWatchlist(
  payload: { market?: string; since?: string },
  sendResponse: (response: any) => void
) {
  try {
    const watchlist = await api.getWatchlist(payload.market, payload.since);
    sendResponse({ success: true, data: watchlist });
  } catch (error) {
    console.error("[LexyHub] Error fetching watchlist:", error);
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleAddToWatchlist(
  payload: { term: string; market: string; source_url?: string },
  sendResponse: (response: any) => void
) {
  try {
    const result = await api.addToWatchlist(payload);
    sendResponse({ success: true, data: result });

    // Invalidate cached watchlist
    await storage.remove(`watchlist:${payload.market}`);
  } catch (error) {
    console.error("[LexyHub] Error adding to watchlist:", error);
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleGetMetrics(
  payload: { terms: string[]; market: string },
  sendResponse: (response: any) => void
) {
  try {
    const metrics = await api.getMetricsBatch(payload.terms, payload.market);
    sendResponse({ success: true, data: metrics });
  } catch (error) {
    console.error("[LexyHub] Error fetching metrics:", error);
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleCreateBrief(
  payload: { terms: string[]; market: string },
  sendResponse: (response: any) => void
) {
  try {
    const brief = await api.createBrief(payload.terms, payload.market);
    sendResponse({ success: true, data: brief });
  } catch (error) {
    console.error("[LexyHub] Error creating brief:", error);
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleCaptureEvent(
  payload: {
    source: string;
    url: string;
    terms: Array<{ t: string; w: number; pos: string }>;
    serp_meta?: any;
  },
  sendResponse: (response: any) => void
) {
  try {
    await api.captureEvent(payload);
    sendResponse({ success: true });
  } catch (error) {
    console.error("[LexyHub] Error capturing event:", error);
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleGetSettings(sendResponse: (response: any) => void) {
  try {
    const settings = await storage.get("settings");
    sendResponse({ success: true, data: settings });
  } catch (error) {
    console.error("[LexyHub] Error getting settings:", error);
    sendResponse({ success: false, error: String(error) });
  }
}

async function handleUpdateSettings(
  payload: any,
  sendResponse: (response: any) => void
) {
  try {
    const currentSettings = (await storage.get("settings")) || {};
    const updatedSettings = { ...currentSettings, ...payload };
    await storage.set("settings", updatedSettings);
    sendResponse({ success: true, data: updatedSettings });
  } catch (error) {
    console.error("[LexyHub] Error updating settings:", error);
    sendResponse({ success: false, error: String(error) });
  }
}

// Alarm handler for periodic tasks
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "fetch-remote-config") {
    await remoteConfig.fetch();
  }
});

// Set up periodic remote config fetch (every 15 minutes)
chrome.alarms.create("fetch-remote-config", {
  periodInMinutes: 15,
});

async function handleSaveSession(
  payload: any,
  sendResponse: (response: any) => void
) {
  try {
    const response_data = await api.saveSession(payload);
    sendResponse({ success: true, data: response_data });
  } catch (error) {
    console.error("[LexyHub] Error saving session:", error);
    sendResponse({ success: false, error: String(error) });
  }
}

// Context Menu Setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "lexyhub-send-to-watchlist",
    title: "Add '%s' to LexyHub Watchlist",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "lexyhub-create-brief",
    title: "Create LexyHub Brief for '%s'",
    contexts: ["selection"],
  });
});

// Context Menu Click Handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText?.trim();
  if (!selectedText) return;

  // Detect market from tab URL
  const market = detectMarketFromUrl(tab?.url || '');

  if (info.menuItemId === "lexyhub-send-to-watchlist") {
    try {
      await api.addToWatchlist({
        term: selectedText,
        market,
        source_url: tab?.url,
      });

      // Show notification
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: "LexyHub",
        message: `Added "${selectedText}" to watchlist`,
      });
    } catch (error) {
      console.error("[LexyHub] Error adding from context menu:", error);
    }
  } else if (info.menuItemId === "lexyhub-create-brief") {
    try {
      await api.createBrief([selectedText], market);

      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: "LexyHub",
        message: `Creating brief for "${selectedText}"...`,
      });
    } catch (error) {
      console.error("[LexyHub] Error creating brief from context menu:", error);
    }
  }
});

function detectMarketFromUrl(url: string): string {
  if (url.includes('etsy.com')) return 'etsy';
  if (url.includes('amazon.')) return 'amazon';
  if (url.includes('google.com/search')) return 'google';
  if (url.includes('pinterest.')) return 'pinterest';
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('bing.com')) return 'bing';
  return 'shopify'; // default
}

console.log("[LexyHub] Background service worker initialized");
