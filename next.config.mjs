/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externalize = new Set(["playwright", "playwright-core", "chromium-bidi", "electron"]);
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
    return config;
  },
};

export default nextConfig;
