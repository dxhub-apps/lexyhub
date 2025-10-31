"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Topbar } from "./Topbar";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", description: "Quota pulse" },
  { href: "/watchlists", label: "Watchlists", description: "Monitored items" },
  { href: "/keywords", label: "Keywords", description: "AI search" },
  { href: "/insights", label: "Insights", description: "Visual AI" },
  { href: "/market-twin", label: "Market Twin", description: "Simulations" },
  { href: "/settings", label: "Settings", description: "Plan & team" },
  { href: "/status", label: "Status", description: "Service status" },
  { href: "/admin/backoffice", label: "Backoffice", description: "Admin controls" },
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

  const toggleSidebar = () => {
    setCollapsed((value) => !value);
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className={`app-shell ${collapsed ? "app-shell-collapsed" : ""}`}>
          <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
            <div className="sidebar-header">
              <span className="badge">LexyHub Platform</span>
              <button
                type="button"
                className="sidebar-toggle"
                aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
                onClick={toggleSidebar}
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
            <Topbar isMobile={isMobile} isCollapsed={collapsed} onToggleSidebar={toggleSidebar} />
            <main className="content-inner">{children}</main>
          </section>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
