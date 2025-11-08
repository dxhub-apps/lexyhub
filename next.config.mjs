import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Optimize production builds
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  // Compression
  compress: true,

  // Image optimization
  images: {
    domains: [
      // avatar default
      "avatar.vercel.sh",
      // oauth commons
      "lh3.googleusercontent.com",
      "avatars.githubusercontent.com",
      // your specific Vercel Blob bucket
      "nkckrqwxwgv0epzk.public.blob.vercel-storage.com",
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  // Webpack optimizations
  webpack: (config, { isServer, dev }) => {
    // Externalize heavy server-side dependencies
    if (isServer) {
      const externalize = new Set([
        "playwright",
        "playwright-core",
        "chromium-bidi",
        "electron",
      ]);
      const existing = Array.isArray(config.externals)
        ? [...config.externals]
        : config.externals
          ? [config.externals]
          : [];
      existing.push((context, callback) => {
        const request = context?.request;
        if (request && externalize.has(request)) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      });
      config.externals = existing;
    }

    // Production optimizations
    if (!dev) {
      // Tree shaking
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: true,
      };
    }

    return config;
  },

  // Experimental features for performance
  experimental: {
    optimizePackageImports: [
      "@supabase/supabase-js",
      "@vercel/analytics",
      "pino",
    ],
    // Enable instrumentation for Sentry and other monitoring tools
    instrumentationHook: true,
  },

  // Headers for security and caching
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Automatically annotate React components for easier debugging
  reactComponentAnnotation: {
    enabled: true,
  },

  // Disable telemetry
  telemetry: false,
};

// Additional Sentry build options
const sentryBuildOptions = {
  // Automatically instrument the code for Sentry
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,

  // Hide source maps from public
  hideSourceMaps: true,

  // Disable Sentry during development for faster builds
  disableLogger: process.env.NODE_ENV === "development",
};

// Make sure adding Sentry options is the last code to run before exporting
export default withSentryConfig(
  withBundleAnalyzer(nextConfig),
  sentryWebpackPluginOptions,
  sentryBuildOptions
);
