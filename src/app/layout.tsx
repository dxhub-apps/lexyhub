import "./globals.css";

import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "LexyHub — AI-first commerce intelligence",
  description: "Cross-market commerce intelligence powered by AI. Synthetic data, Amazon, Etsy, Google, Pinterest, and Reddit insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
