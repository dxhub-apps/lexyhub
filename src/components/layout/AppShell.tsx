"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Star,
  Search,
  User,
  Shield,
} from "lucide-react";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Topbar } from "./Topbar";
import { Sidebar, type SidebarNavItem } from "./Sidebar";
import { TopBanner } from "@/components/notifications/TopBanner";
import { cn } from "@/lib/utils";

const NAV_ITEMS: readonly SidebarNavItem[] = [
  {
    href: "/dashboard",
    label: "Home",
    description: "Overview & quota",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    href: "/keywords",
    label: "Search",
    description: "Keyword intelligence",
    icon: <Search className="h-5 w-5" />,
  },
  {
    href: "/watchlists",
    label: "Watchlist",
    description: "Tracked keywords",
    icon: <Star className="h-5 w-5" />,
  },
  {
    href: "/profile",
    label: "Profile",
    description: "Account settings",
    icon: <User className="h-5 w-5" />,
  },
  {
    href: "/admin/backoffice",
    label: "Admin",
    description: "Admin controls",
    icon: <Shield className="h-5 w-5" />,
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
          return currentPath.startsWith("/admin");
        }
        if (item.href === "/profile") {
          return currentPath.startsWith("/profile");
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
      <div className="min-h-screen bg-background">
        <Sidebar
          navItems={nav}
          pathname={pathname ?? "/"}
          collapsed={sidebarCollapsed}
          isMobile={isMobile}
          navOpen={navOpen}
          onToggleCollapse={toggleSidebarCollapsed}
          onDismissMobile={closeNav}
        />

        {/* Mobile overlay backdrop */}
        {isMobile && navOpen && (
          <div
            className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={closeNav}
          />
        )}

        {/* Main content area */}
        <div
          className={cn(
            "flex min-h-screen flex-col transition-all duration-200",
            sidebarCollapsed && !isMobile ? "ml-16" : "ml-64",
            isMobile && "ml-0"
          )}
        >
          <Topbar
            isMobile={isMobile}
            navOpen={navOpen}
            onToggleNav={toggleNav}
            onToggleSidebar={toggleSidebarCollapsed}
            sidebarCollapsed={sidebarCollapsed}
            activeNavItem={activeNavItem}
          />

          <div className="pt-16">
            <TopBanner />
          </div>

          <main className="flex-1">
            <div className="app-container">{children}</div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
