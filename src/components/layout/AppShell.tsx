"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/keywords", label: "Keywords" },
  { href: "/insights", label: "Insights" },
  { href: "/settings", label: "Settings" },
  { href: "/status", label: "Status" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const nav = useMemo(() => NAV_ITEMS, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <span className="badge">Sprint 1 — Synthetic Intelligence</span>
        </div>
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname?.startsWith(item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </aside>
      <section className="content">
        <header className="topbar">
          <div>
            <strong>LexyHub Control Center</strong>
          </div>
          <div className="topbar-env">
            <span>Environment:</span>
            <span>{process.env.NODE_ENV}</span>
          </div>
        </header>
        <main className="content-inner">{children}</main>
      </section>
    </div>
  );
}
