import { env } from "@/lib/env";

export const ETSY_OAUTH_BASE = "https://www.etsy.com/oauth/connect";
export const ETSY_API_BASE = "https://openapi.etsy.com/v3/application";

export type EtsyOAuthScope =
  | "listings_w"
  | "listings_r"
  | "shops_r"
  | "transactions_r"
  | "profile_r";

export type EtsyTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  created_at?: number;
};

export type EtsyShop = {
  shop_id: number;
  shop_name: string;
  is_vacation: boolean;
  create_date?: number;
  update_date?: number;
  currency_code?: string;
};

export type EtsyListing = {
  listing_id: number;
  title: string;
  description?: string;
  state: string;
  quantity: number;
  url: string;
  price?: { amount: number; divisor: number; currency_code: string };
  tags?: string[];
  views?: number;
  num_favorers?: number;
  original_create_timestamp?: number;
  last_modified_timestamp?: number;
};

export type EtsyListingResult = {
  listings: EtsyListing[];
  total: number;
  cursor?: string | null;
};

export function isEtsyConfigured(): boolean {
  return Boolean(env.ETSY_CLIENT_ID && env.ETSY_CLIENT_SECRET && env.ETSY_REDIRECT_URI);
}

export function buildEtsyAuthorizationUrl({
  state,
  scopes = ["listings_r", "listings_w", "shops_r"],
  redirectUri = env.ETSY_REDIRECT_URI,
}: {
  state: string;
  scopes?: EtsyOAuthScope[];
  redirectUri?: string;
}): string {
  if (!redirectUri) {
    throw new Error("ETSY_REDIRECT_URI is not configured");
  }

  const url = new URL(ETSY_OAUTH_BASE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("client_id", env.ETSY_CLIENT_ID ?? "");
  url.searchParams.set("state", state);
  return url.toString();
}

async function requestEtsy<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!isEtsyConfigured()) {
    throw new Error("Etsy credentials are not configured");
  }

  const url = path.startsWith("http") ? path : `${ETSY_API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Etsy API request failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function exchangeEtsyCode(code: string): Promise<EtsyTokenResponse> {
  if (!isEtsyConfigured()) {
    return {
      access_token: `demo-access-${code}`,
      refresh_token: `demo-refresh-${code}`,
      expires_in: 3600,
      token_type: "Bearer",
      scope: "listings_r shops_r",
    };
  }

  const credentials = Buffer.from(`${env.ETSY_CLIENT_ID}:${env.ETSY_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.ETSY_CLIENT_ID ?? "",
      redirect_uri: env.ETSY_REDIRECT_URI ?? "",
      code,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to exchange Etsy code: ${response.status} ${text}`);
  }

  return (await response.json()) as EtsyTokenResponse;
}

export async function refreshEtsyToken(refreshToken: string): Promise<EtsyTokenResponse> {
  if (!isEtsyConfigured()) {
    return {
      access_token: `demo-access-${refreshToken}`,
      refresh_token: refreshToken,
      expires_in: 3600,
      token_type: "Bearer",
      scope: "listings_r shops_r",
    };
  }

  const credentials = Buffer.from(`${env.ETSY_CLIENT_ID}:${env.ETSY_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh Etsy token: ${response.status} ${text}`);
  }

  return (await response.json()) as EtsyTokenResponse;
}

export async function fetchEtsyShops(accessToken: string): Promise<EtsyShop[]> {
  if (!isEtsyConfigured()) {
    return [
      {
        shop_id: 123456,
        shop_name: "Lexy Demo Studio",
        is_vacation: false,
        create_date: Math.floor(Date.now() / 1000) - 86400 * 365,
        update_date: Math.floor(Date.now() / 1000),
        currency_code: "USD",
      },
    ];
  }

  const result = await requestEtsy<{ results: EtsyShop[] }>("/shops", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return result.results ?? [];
}

export async function fetchEtsyListings(
  accessToken: string,
  shopId: number,
  options: { limit?: number; updatedSince?: string | Date | null; cursor?: string | null } = {},
): Promise<EtsyListingResult> {
  if (!isEtsyConfigured()) {
    const now = Math.floor(Date.now() / 1000);
    return {
      total: 1,
      listings: [
        {
          listing_id: 987654,
          title: "Handmade Cerulean Mug",
          description: "Wheel-thrown stoneware mug with matte glaze.",
          state: "active",
          quantity: 12,
          url: "https://www.etsy.com/listing/987654/handmade-cerulean-mug",
          price: { amount: 4800, divisor: 100, currency_code: "USD" },
          tags: ["ceramic", "mug", "handmade"],
          views: 215,
          num_favorers: 48,
          original_create_timestamp: now - 86400 * 30,
          last_modified_timestamp: now,
        },
      ],
    };
  }

  const params = new URLSearchParams();
  params.set("limit", String(Math.min(options.limit ?? 100, 200)));
  if (options.cursor) {
    params.set("cursor", options.cursor);
  }
  if (options.updatedSince) {
    const date = options.updatedSince instanceof Date ? options.updatedSince : new Date(options.updatedSince);
    params.set("min_last_modified_tsz", Math.floor(date.getTime() / 1000).toString());
  }

  const result = await requestEtsy<{ results: EtsyListing[]; count: number; next?: string }>(
    `/shops/${shopId}/listings/active?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  return {
    listings: result.results ?? [],
    total: result.count ?? (result.results?.length ?? 0),
    cursor: result.next ?? null,
  };
}
