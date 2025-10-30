"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ToastProvider } from "@/components/ui/ToastProvider";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", description: "Quota pulse" },
  { href: "/keywords", label: "Keywords", description: "AI search" },
  { href: "/insights", label: "Insights", description: "Visual AI" },
  { href: "/settings", label: "Settings", description: "Plan & team" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const nav = useMemo(() => NAV_ITEMS, []);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 900;
      setIsMobile(mobile);
      setCollapsed(mobile);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <ToastProvider>
      <div className={`app-shell ${collapsed ? "app-shell-collapsed" : ""}`}>
        <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
          <div className="sidebar-header">
            <span className="badge">Sprint 2 — AI Enhancements</span>
            <button
              type="button"
              className="sidebar-toggle"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? "☰" : "×"}
            </button>
          </div>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname?.startsWith(item.href) ? "page" : undefined}
              className="sidebar-link"
              title={collapsed ? item.label : undefined}
              data-tooltip={item.description}
            >
              <span className="sidebar-link-text">{item.label}</span>
            </Link>
          ))}
        </aside>
        <section className="content">
          <header className="topbar">
            <div className="topbar-meta">
              <strong>LexyHub Control Center</strong>
              <span className="topbar-subtitle">Momentum-aware quotas & watchlists</span>
            </div>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "#cbd5f5" }}>
                Environment: {process.env.NODE_ENV}
              </span>
              {isMobile ? (
                <button
                  type="button"
                  className="sidebar-toggle mobile"
                  aria-label={collapsed ? "Open navigation" : "Hide navigation"}
                  onClick={() => setCollapsed((value) => !value)}
                >
                  ☰
                </button>
              ) : null}
            </div>
          </header>
          <main className="content-inner">{children}</main>
        </section>
      </div>
    </ToastProvider>
  );
}
