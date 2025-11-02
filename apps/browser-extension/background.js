const CONFIG_URL = chrome.runtime.getURL("config.json");
const STORAGE_KEYS = {
  authToken: "lexyhub:auth-token",
  telemetryPreference: "lexyhub:allow-telemetry",
  keywordContext: "lexyhub:keyword-context",
};

let config = {
  apiBaseUrl: "",
  allowUserTelemetryDefault: false,
};

let authToken = null;
let telemetryPreference = null;
let keywordContext = null;

async function loadConfig() {
  try {
    const response = await fetch(CONFIG_URL);
    if (!response.ok) {
      console.warn("LexyHub extension unable to load config.json", response.status);
      return;
    }

    const data = await response.json();
    config = {
      apiBaseUrl: typeof data.apiBaseUrl === "string" ? data.apiBaseUrl : "",
      allowUserTelemetryDefault: Boolean(data.allowUserTelemetryDefault),
    };
  } catch (error) {
    console.warn("LexyHub extension failed to hydrate config", error);
  }
}

async function hydrateStateFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(Object.values(STORAGE_KEYS), (items) => {
      authToken = typeof items[STORAGE_KEYS.authToken] === "string" ? items[STORAGE_KEYS.authToken] : null;
      telemetryPreference =
        typeof items[STORAGE_KEYS.telemetryPreference] === "boolean"
          ? items[STORAGE_KEYS.telemetryPreference]
          : null;
      keywordContext = items[STORAGE_KEYS.keywordContext] ?? null;
      resolve();
    });
  });
}

function persistToStorage(key, value) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [key]: value }, () => resolve());
  });
}

function isTelemetryEnabled() {
  if (typeof telemetryPreference === "boolean") {
    return telemetryPreference;
  }

  return Boolean(config.allowUserTelemetryDefault);
}

function normalizeApiUrl(path) {
  const baseUrl = config.apiBaseUrl?.replace(/\/$/, "") ?? "";
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function sendKeywordEvent(event) {
  if (!isTelemetryEnabled()) {
    return { ok: false, reason: "telemetry-disabled" };
  }

  if (!authToken) {
    return { ok: false, reason: "missing-auth" };
  }

  if (!config.apiBaseUrl) {
    return { ok: false, reason: "missing-config" };
  }

  try {
    const response = await fetch(normalizeApiUrl("/api/keyword-events"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("LexyHub extension failed to send event", response.status, errorText);
      return { ok: false, reason: "request-failed", status: response.status };
    }

    return { ok: true };
  } catch (error) {
    console.error("LexyHub extension encountered a network error", error);
    return { ok: false, reason: "network-error" };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "lexyhub:set-auth-token" && typeof message.token === "string") {
    authToken = message.token;
    void persistToStorage(STORAGE_KEYS.authToken, message.token);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "lexyhub:set-telemetry" && typeof message.allow === "boolean") {
    telemetryPreference = message.allow;
    void persistToStorage(STORAGE_KEYS.telemetryPreference, message.allow);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "lexyhub:set-keyword-context" && message.context) {
    keywordContext = message.context;
    void persistToStorage(STORAGE_KEYS.keywordContext, message.context);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "lexyhub:get-keyword-context") {
    sendResponse({ ok: true, context: keywordContext });
    return true;
  }

  if (message.type === "lexyhub:keyword-event" && message.event) {
    void sendKeywordEvent(message.event).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  return undefined;
});

void loadConfig();
void hydrateStateFromStorage();
