import "./globals.css";

import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/toaster";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { ClientErrorHandler } from "@/components/ClientErrorHandler";

export const metadata: Metadata = {
  title: "LexyHub — AI-first commerce intelligence",
  description: "Cross-market commerce intelligence powered by AI. Synthetic data, Amazon, Etsy, Google, Pinterest, and Reddit insights.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClientErrorHandler />
        <PostHogProvider>
          {children}
          <Toaster />
          <Analytics />
        </PostHogProvider>
      </body>
    </html>
  );
}
