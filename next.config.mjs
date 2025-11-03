import bundleAnalyzer from "@next/bundle-analyzer";

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

export default withBundleAnalyzer(nextConfig);
