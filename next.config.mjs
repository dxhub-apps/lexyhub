/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      // avatar default
      "avatar.vercel.sh",
      // supabase (se usar)
      "your-project-ref.supabase.co",
      // oauth comuns
      "lh3.googleusercontent.com",
      "avatars.githubusercontent.com",
      // seu Vercel Blob exato
      "nkckrqwxwgv0epzk.public.blob.vercel-storage.com",
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
