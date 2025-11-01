declare module "playwright-core" {
  export interface Response {
    status(): number;
  }

  export interface Page {
    goto(url: string, options?: unknown): Promise<Response | null>;
    waitForTimeout(timeout: number): Promise<void>;
    content(): Promise<string>;
    close(): Promise<void>;
  }

  export interface BrowserContext {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  export interface Browser {
    newContext(options?: unknown): Promise<BrowserContext>;
    close(): Promise<void>;
  }

  export interface BrowserType<TBrowser> {
    launch(options?: unknown): Promise<TBrowser>;
  }

  export const chromium: BrowserType<Browser>;
}

declare module "playwright" {
  export * from "playwright-core";
}
