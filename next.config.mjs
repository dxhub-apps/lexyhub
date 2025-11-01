/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
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
      existing.push((context, request, callback) => {
        const identifier = request ?? context?.request;
        if (identifier && externalize.has(identifier)) {
          return callback(null, `commonjs ${identifier}`);
        }
        callback();
      });
      config.externals = existing;
    }
    return config;
  },
};

export default nextConfig;
