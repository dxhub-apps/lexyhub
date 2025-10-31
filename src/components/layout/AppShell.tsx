"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Box, Toolbar, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  AdminPanelSettingsRounded,
  AssessmentRounded,
  BarChartRounded,
  DashboardRounded,
  HubRounded,
  SettingsRounded,
  ShieldRounded,
  StarRounded,
} from "@mui/icons-material";

import { ToastProvider } from "@/components/ui/ToastProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Topbar } from "./Topbar";
import { Sidebar, type SidebarNavItem } from "./Sidebar";

const NAV_ITEMS: readonly SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", description: "Quota pulse", icon: DashboardRounded },
  { href: "/watchlists", label: "Watchlists", description: "Monitored items", icon: StarRounded },
  { href: "/keywords", label: "Keywords", description: "AI search", icon: AssessmentRounded },
  { href: "/insights", label: "Insights", description: "Visual AI", icon: BarChartRounded },
  { href: "/market-twin", label: "Market Twin", description: "Simulations", icon: HubRounded },
  { href: "/settings", label: "Settings", description: "Plan & team", icon: SettingsRounded },
  { href: "/status", label: "Status", description: "Service status", icon: ShieldRounded },
  { href: "/admin/backoffice", label: "Backoffice", description: "Admin controls", icon: AdminPanelSettingsRounded },
] as const;

const COLLAPSED_WIDTH = 88;
const EXPANDED_WIDTH = 288;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppShellContent>{children}</AppShellContent>
      </ToastProvider>
    </ThemeProvider>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(false);
    } else {
      setNavOpen(false);
    }
  }, [isMobile]);

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

  const sidebarWidth = sidebarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <Sidebar
        navItems={nav}
        pathname={pathname ?? "/"}
        collapsed={sidebarCollapsed}
        isMobile={isMobile}
        navOpen={navOpen}
        width={sidebarWidth}
        onToggleCollapse={toggleSidebarCollapsed}
        onDismissMobile={closeNav}
      />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <Topbar
          isMobile={isMobile}
          navOpen={navOpen}
          onToggleNav={toggleNav}
          onToggleSidebar={toggleSidebarCollapsed}
          sidebarCollapsed={sidebarCollapsed}
          activeNavItem={activeNavItem}
        />
        <Toolbar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            px: { xs: 2, md: 3, xl: 5 },
            py: { xs: 2, md: 3 },
            bgcolor: "background.default",
          }}
        >
          <Box
            sx={{
              maxWidth: "min(1280px, 100%)",
              mx: "auto",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: { xs: 2.5, md: 3 },
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
