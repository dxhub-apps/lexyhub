"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Topbar } from "./Topbar";
import { Sidebar, type SidebarNavItem } from "./Sidebar";

const iconProps = {
  width: 20,
  height: 20,
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none" as const,
};

const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <path d="M4.5 4.5h5v7h-5zM4.5 14.5h5v5h-5zM14.5 4.5h5v5h-5zM11 10.5h8.5v9H11z" />
  </svg>
);

const WatchlistIcon = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <path d="m12 17.5-3.3 1.7.6-3.7-2.7-2.7 3.7-.5L12 9l1.7 3.3 3.7.5-2.7 2.7.6 3.7z" />
  </svg>
);

const KeywordsIcon = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <circle cx="11" cy="11" r="5.5" />
    <path d="m15.5 15.5 4 4" />
  </svg>
);

const InsightsIcon = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <path d="M4.5 15.5 8 12l3 3 6-6 2.5 2.5" />
    <path d="M4.5 19.5h15" />
  </svg>
);

const MarketTwinIcon = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <path d="M7.5 6.5a4.5 4.5 0 0 1 9 0c0 2.5-2 4-4.5 6.5-2.5-2.5-4.5-4-4.5-6.5z" />
    <path d="M5.5 18.5c0-2.1 1.9-3.4 3.6-4.8M18.5 18.5c0-2.1-1.9-3.4-3.6-4.8" />
    <path d="M5.5 18.5h13" />
  </svg>
);

const EditingIcon = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <path d="m5.5 17.5-.5 3 3-.5 10.5-10.5-2.5-2.5z" />
    <path d="m16.5 7.5 2.5 2.5" />
    <path d="M5.5 17.5 4 19" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <path d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
    <path d="M4.5 13.5v-3l2.1-.5a5.5 5.5 0 0 1 1.2-2.1l-.5-2.1 2.1-2.1 2.1.5a5.5 5.5 0 0 1 2.1-1.2l.5-2.1h3l.5 2.1a5.5 5.5 0 0 1 2.1 1.2l2.1-.5 2.1 2.1-.5 2.1a5.5 5.5 0 0 1 1.2 2.1l2.1.5v3l-2.1.5a5.5 5.5 0 0 1-1.2 2.1l.5 2.1-2.1 2.1-2.1-.5a5.5 5.5 0 0 1-2.1 1.2l-.5 2.1h-3l-.5-2.1a5.5 5.5 0 0 1-2.1-1.2l-2.1.5-2.1-2.1.5-2.1a5.5 5.5 0 0 1-1.2-2.1z" />
  </svg>
);

const StatusIcon = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <path d="M4.5 13.5 9 9l4 5 3-3 3.5 3.5" />
    <path d="M4.5 18.5h15" />
  </svg>
);

const BackofficeIcon = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <path d="M12 4.5 5.5 8v5c0 4.7 3.7 7.9 6.5 9 2.8-1.1 6.5-4.3 6.5-9v-5z" />
    <path d="M10 12.5 12 14l2-1.5V11h-4z" />
  </svg>
);

const NAV_ITEMS: readonly SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", description: "Quota pulse", icon: <DashboardIcon /> },
  {
    href: "/watchlists",
    label: "Watchlists",
    description: "Monitored items",
    icon: <WatchlistIcon />,
  },
  { href: "/keywords", label: "Keywords", description: "AI search", icon: <KeywordsIcon /> },
  { href: "/insights", label: "Insights", description: "Visual AI", icon: <InsightsIcon /> },
  {
    href: "/market-twin",
    label: "Market Twin",
    description: "Simulations",
    icon: <MarketTwinIcon />,
  },
  {
    href: "/editing",
    label: "Editing",
    description: "Etsy suite",
    icon: <EditingIcon />,
  },
  { href: "/settings", label: "Settings", description: "Plan & team", icon: <SettingsIcon /> },
  { href: "/status", label: "Status", description: "Service status", icon: <StatusIcon /> },
  {
    href: "/admin/backoffice",
    label: "Backoffice",
    description: "Admin controls",
    icon: <BackofficeIcon />,
  },
] as const;

type AppShellProps = {
  children: ReactNode;
  isAdmin: boolean;
};

export function AppShell({ children, isAdmin }: AppShellProps) {
  const pathname = usePathname();
  const nav = useMemo(
    () => NAV_ITEMS.filter((item) => isAdmin || item.href !== "/admin/backoffice"),
    [isAdmin],
  );
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
