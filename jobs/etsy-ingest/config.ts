import { z } from "zod";

export type IngestConfig = {
  listingUrl: string;
  marketplaceAccountId: string;
  providerId: string;
  providerName: string;
  shopUrl?: string;
  featureFlags: string[];
  keywordsEnabled: boolean;
};

type ParsedArgs = Record<string, string | boolean>;

function parseCliArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    if (token.startsWith("--no-")) {
      const key = token.slice(5);
      args[key] = false;
      continue;
    }

    const [rawKey, rawValue] = token.split("=", 2);
    const key = rawKey.replace(/^--/, "");
    if (rawValue !== undefined) {
      args[key] = rawValue;
      continue;
    }

    const maybeValue = argv[index + 1];
    if (maybeValue && !maybeValue.startsWith("--")) {
      args[key] = maybeValue;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

const configSchema = z.object({
  listingUrl: z.string().url({ message: "A valid Etsy listing URL is required" }),
  marketplaceAccountId: z
    .string()
    .uuid({ message: "ETSY_INGEST_MARKETPLACE_ACCOUNT_ID (or --account) must be a UUID" }),
  providerId: z.string().min(1).default("etsy"),
  providerName: z.string().min(1).default("Etsy Marketplace"),
  shopUrl: z.string().url().optional(),
  featureFlags: z.array(z.string()).default([]),
  keywordsEnabled: z.boolean().default(true),
});

export function loadConfig(argv: string[] = process.argv.slice(2)): IngestConfig {
  const args = parseCliArgs(argv);
  const featureFlags = new Set<string>();
  const envFeatureFlags = process.env.ETSY_INGEST_FEATURE_FLAGS;
  if (envFeatureFlags) {
    envFeatureFlags
      .split(",")
      .map((flag) => flag.trim())
      .filter(Boolean)
      .forEach((flag) => featureFlags.add(flag));
  }
  const argFeatureFlags = args["feature"];
  if (typeof argFeatureFlags === "string") {
    argFeatureFlags
      .split(",")
      .map((flag) => flag.trim())
      .filter(Boolean)
      .forEach((flag) => featureFlags.add(flag));
  }

  const config = configSchema.parse({
    listingUrl: (args["listing"] as string | undefined) ?? process.env.ETSY_INGEST_LISTING_URL,
    marketplaceAccountId:
      (args["account"] as string | undefined) ?? process.env.ETSY_INGEST_MARKETPLACE_ACCOUNT_ID,
    providerId: (args["provider"] as string | undefined) ?? process.env.ETSY_INGEST_PROVIDER_ID ?? "etsy",
    providerName:
      (args["provider-name"] as string | undefined) ?? process.env.ETSY_INGEST_PROVIDER_NAME ?? "Etsy Marketplace",
    shopUrl: (args["shop"] as string | undefined) ?? process.env.ETSY_INGEST_SHOP_URL,
    featureFlags: Array.from(featureFlags),
    keywordsEnabled: (() => {
      if (typeof args["keywords"] === "boolean") {
        return Boolean(args["keywords"]);
      }
      if (args["keywords"] === "false") {
        return false;
      }
      if (process.env.ETSY_INGEST_DISABLE_KEYWORDS === "true") {
        return false;
      }
      return true;
    })(),
  });

  return config;
}
