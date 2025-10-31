import "./globals.css";

import type { Metadata } from "next";

import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "LexyHub",
  description: "LexyHub platform shell",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
