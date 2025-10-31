import { withSentryConfig } from "@sentry/nextjs";

import sentryConfig from "./sentry.config.mjs";

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatar.vercel.sh",
      },
    ],
  },
};

const nextConfig = withSentryConfig(
  baseConfig,
  sentryConfig,
  {
    silent: true,
  },
);

export default nextConfig;
