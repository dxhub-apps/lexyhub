// src/app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LexyHub",
  description: "LexyHub API and apps"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
