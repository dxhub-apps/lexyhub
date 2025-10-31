"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Topbar } from "./Topbar";
import { Sidebar, type SidebarNavItem } from "./Sidebar";

const NAV_ITEMS: readonly SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", description: "Quota pulse" },
  { href: "/watchlists", label: "Watchlists", description: "Monitored items" },
  { href: "/keywords", label: "Keywords", description: "AI search" },
  { href: "/insights", label: "Insights", description: "Visual AI" },
  { href: "/market-twin", label: "Market Twin", description: "Simulations" },
  { href: "/settings", label: "Settings", description: "Plan & team" },
  { href: "/status", label: "Status", description: "Service status" },
  { href: "/admin/backoffice", label: "Backoffice", description: "Admin controls" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const nav = useMemo(() => NAV_ITEMS, []);
  const activeNavItem = useMemo(() => {
    const currentPath = pathname ?? "/";
    if (currentPath === "/") {
      return nav[0];
    }
    return (
      nav.find((item) => {
        if (item.href === "/dashboard") {
          return currentPath.startsWith("/dashboard");
        }
        if (item.href === "/admin/backoffice") {
          return currentPath.startsWith("/admin/backoffice");
        }
        return currentPath.startsWith(item.href);
      }) ?? nav[0]
    );
  }, [nav, pathname]);
  const [isMobile, setIsMobile] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = window.innerWidth <= 768;
      setIsMobile(nextIsMobile);
      if (nextIsMobile) {
        setSidebarCollapsed(false);
      }
      if (!nextIsMobile) {
        setNavOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const toggleNav = () => {
    setNavOpen((value) => !value);
  };

  const closeNav = () => {
    setNavOpen(false);
  };

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((value) => !value);
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className={`app-shell${sidebarCollapsed ? " app-shell-collapsed" : ""}`}>
          <Sidebar
            navItems={nav}
            pathname={pathname ?? "/"}
            collapsed={sidebarCollapsed}
            isMobile={isMobile}
            navOpen={navOpen}
            onToggleCollapse={toggleSidebarCollapsed}
            onDismissMobile={closeNav}
          />
          {isMobile && navOpen ? (
            <button
              type="button"
              className="app-sidebar-overlay"
              aria-label="Close navigation"
              onClick={closeNav}
            />
          ) : null}
          <div className="app-shell-content">
            <Topbar
              isMobile={isMobile}
              navOpen={navOpen}
              onToggleNav={toggleNav}
              onToggleSidebar={toggleSidebarCollapsed}
              sidebarCollapsed={sidebarCollapsed}
              activeNavItem={activeNavItem}
            />
            <main className="app-main">
              <div className="app-container">{children}</div>
            </main>
          </div>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
