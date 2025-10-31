"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Topbar } from "./Topbar";
import { ui } from "@/ui/theme";

const NAV_ITEMS = [
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
  const [isMobile, setIsMobile] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = window.innerWidth <= 768;
      setIsMobile(nextIsMobile);
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

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="app-frame" style={{ background: ui.colors.page }}>
          <Topbar
            navItems={nav}
            pathname={pathname ?? "/"}
            isMobile={isMobile}
            navOpen={navOpen}
            onToggleNav={toggleNav}
          />
          <main className="app-main">
            <div className="app-container">{children}</div>
          </main>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
