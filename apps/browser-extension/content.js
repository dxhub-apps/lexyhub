(function () {
  const EXTENSION_CHANNEL = "lexyhub-extension";
  const TELEMETRY_EVENT_TYPES = new Set(["search", "view_listing", "view_shop"]);
  let lastEventSignature = null;
  let cachedKeywordContext = null;

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function postToBackground(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          resolve(response);
        });
      } catch (error) {
        console.warn("LexyHub extension unable to send message", error);
        resolve({ ok: false, reason: "message-failed" });
      }
    });
  }

  async function ensureKeywordContext() {
    if (cachedKeywordContext) {
      return cachedKeywordContext;
    }

    const response = await postToBackground({ type: "lexyhub:get-keyword-context" });
    if (response?.ok) {
      cachedKeywordContext = response.context ?? null;
      return cachedKeywordContext;
    }

    return null;
  }

  function captureSearchEvent() {
    const params = new URLSearchParams(window.location.search);
    const query = params.get("search_query") || params.get("q");
    if (!query) {
      return;
    }

    void ensureKeywordContext().then((context) => {
      const keywordId = context?.keywordId;
      if (!keywordId) {
        return;
      }

      const signature = `search:${keywordId}:${query}`;
      if (lastEventSignature === signature) {
        return;
      }

      lastEventSignature = signature;

      void postToBackground({
        type: "lexyhub:keyword-event",
        event: {
          type: "search",
          keywordId,
          query,
          url: window.location.href,
        },
      });
    });
  }

  function captureListingView() {
    const match = window.location.pathname.match(/listing\/(\d+)/);
    if (!match) {
      return;
    }

    const listingExternalId = match[1];
    void ensureKeywordContext().then((context) => {
      const keywordId = context?.keywordId;
      if (!keywordId) {
        return;
      }

      const signature = `listing:${keywordId}:${listingExternalId}`;
      if (lastEventSignature === signature) {
        return;
      }

      lastEventSignature = signature;

      const payload = {
        type: "view_listing",
        keywordId,
        listingExternalId,
        url: window.location.href,
      };

      const positionElement = document.querySelector("[data-search-results-position]");
      if (positionElement) {
        const raw = positionElement.getAttribute("data-search-results-position");
        const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
        if (!Number.isNaN(parsed)) {
          payload.position = parsed;
        }
      }

      void postToBackground({ type: "lexyhub:keyword-event", event: payload });
    });
  }

  function captureShopView() {
    const match = window.location.pathname.match(/shop\/([^/]+)/);
    if (!match) {
      return;
    }

    const shopSlug = match[1];

    void ensureKeywordContext().then((context) => {
      const keywordId = context?.keywordId;
      if (!keywordId) {
        return;
      }

      const signature = `shop:${keywordId}:${shopSlug}`;
      if (lastEventSignature === signature) {
        return;
      }

      lastEventSignature = signature;

      const shopNameElement = document.querySelector("[data-shop-name]");

      void postToBackground({
        type: "lexyhub:keyword-event",
        event: {
          type: "view_shop",
          keywordId,
          shopSlug,
          shopName: shopNameElement?.textContent?.trim() || undefined,
          url: window.location.href,
        },
      });
    });
  }

  function handleLocationChange() {
    lastEventSignature = null;

    if (window.location.hostname.endsWith("etsy.com")) {
      captureSearchEvent();
      captureListingView();
      captureShopView();
    }
  }

  const debouncedLocationHandler = debounce(handleLocationChange, 250);
  window.addEventListener("popstate", debouncedLocationHandler);
  window.addEventListener("pushstate", debouncedLocationHandler);
  window.addEventListener("replacestate", debouncedLocationHandler);

  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    debouncedLocationHandler();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    debouncedLocationHandler();
  };

  function forwardPageMessages(event) {
    if (event.source !== window || !event.data || typeof event.data !== "object") {
      return;
    }

    const { channel, payload } = event.data;
    if (channel !== EXTENSION_CHANNEL) {
      return;
    }

    if (payload?.type === "telemetry-event" && TELEMETRY_EVENT_TYPES.has(payload.event?.type)) {
      cachedKeywordContext = payload.event?.keywordId
        ? { keywordId: payload.event.keywordId, keywordTerm: payload.event.keywordTerm }
        : cachedKeywordContext;

      void postToBackground({ type: "lexyhub:keyword-event", event: payload.event });
      return;
    }

    if (payload?.type === "set-auth-token" && typeof payload.token === "string") {
      void postToBackground({ type: "lexyhub:set-auth-token", token: payload.token });
      return;
    }

    if (payload?.type === "set-telemetry" && typeof payload.allow === "boolean") {
      void postToBackground({ type: "lexyhub:set-telemetry", allow: payload.allow });
      return;
    }

    if (payload?.type === "set-keyword-context" && payload.context) {
      cachedKeywordContext = payload.context;
      void postToBackground({ type: "lexyhub:set-keyword-context", context: payload.context });
    }
  }

  window.addEventListener("message", forwardPageMessages);

  if (window.location.hostname.endsWith("lexyhub.com")) {
    window.postMessage({ channel: EXTENSION_CHANNEL, payload: { type: "extension-ready" } }, window.origin);
  }

  handleLocationChange();
})();
