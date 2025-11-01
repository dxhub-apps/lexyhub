import type { Browser, BrowserType } from "playwright-core";
import { ETSY_SCRAPER_USER_AGENT } from "./constants";

const DISABLE_FALLBACK = /^(0|false|off)$/i.test(process.env.ETSY_PLAYWRIGHT_FALLBACK ?? "");

let playwrightModulePromise: Promise<BrowserType<Browser> | null> | null = null;
let browserPromise: Promise<Browser> | null = null;

async function loadChromium(): Promise<BrowserType<Browser> | null> {
  if (playwrightModulePromise) {
    return playwrightModulePromise;
  }

  playwrightModulePromise = (async () => {
    if (DISABLE_FALLBACK) {
      return null;
    }
    try {
      const playwright = await import("playwright");
      return playwright.chromium;
    } catch (error) {
      try {
        const playwrightCore = await import("playwright-core");
        return playwrightCore.chromium;
      } catch (innerError) {
        console.warn(
          JSON.stringify({
            method: "playwright-client.loadChromium",
            status: "unavailable",
            error: innerError instanceof Error ? innerError.message : String(innerError),
          }),
        );
        return null;
      }
    }
  })();

  return playwrightModulePromise;
}

async function ensureBrowser(): Promise<Browser | null> {
  if (browserPromise) {
    return browserPromise.catch(() => null);
  }

  browserPromise = (async () => {
    const chromium = await loadChromium();
    if (!chromium) {
      throw new Error("Playwright chromium runtime not available");
    }
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    return browser;
  })();

  try {
    return await browserPromise;
  } catch (error) {
    browserPromise = null;
    throw error;
  }
}

export async function fetchHtmlWithPlaywright(
  url: string,
  options: { referer?: string; timeoutMs?: number } = {},
): Promise<{ html: string; status: number | null } | null> {
  if (DISABLE_FALLBACK) {
    return null;
  }

  let browser: Browser | null = null;
  try {
    browser = await ensureBrowser();
  } catch (error) {
    console.warn(
      JSON.stringify({
        method: "playwright-client.ensureBrowser",
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  }

  if (!browser) {
    return null;
  }

  const context = await browser.newContext({
    userAgent: ETSY_SCRAPER_USER_AGENT,
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
    extraHTTPHeaders: options.referer
      ? {
          Referer: options.referer,
          "Accept-Language": "en-US,en;q=0.9",
        }
      : {
          "Accept-Language": "en-US,en;q=0.9",
        },
  });

  const page = await context.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs ?? 25_000,
    });
    await page.waitForTimeout(500);
    const html = await page.content();
    return { html, status: response?.status() ?? null };
  } catch (error) {
    console.warn(
      JSON.stringify({
        method: "playwright-client.fetchHtmlWithPlaywright",
        url,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  } finally {
    await page.close();
    await context.close();
  }
}

export async function disposePlaywright(): Promise<void> {
  if (!browserPromise) {
    return;
  }
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch (error) {
    console.warn(
      JSON.stringify({
        method: "playwright-client.disposePlaywright",
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  } finally {
    browserPromise = null;
  }
}
