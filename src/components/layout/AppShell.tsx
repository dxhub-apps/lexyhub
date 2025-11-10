"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Brain, ClipboardList, Search, Settings, Shield, Star } from "lucide-react";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Topbar } from "./Topbar";
import { Sidebar, type SidebarNavItem } from "./Sidebar";

const BASE_NAV: readonly SidebarNavItem[] = [
  {
    href: "/search",
    label: "Search",
    description: "Keyword intelligence",
    icon: Search,
  },
  {
    href: "/ask-lexybrain",
    label: "Ask LexyBrain",
    description: "Conversational analysis",
    icon: Brain,
  },
  {
    href: "/watchlist",
    label: "Watchlist",
    description: "Tracked opportunities",
    icon: Star,
  },
];

const ADMIN_NAV: SidebarNavItem = {
  href: "/admin/lexybrain",
  label: "Admin",
  description: "Administrative tools",
  icon: Shield,
};

type AppShellProps = {
  children: ReactNode;
  isAdmin: boolean;
};

export function AppShell({ children, isAdmin }: AppShellProps) {
  const pathname = usePathname() ?? "/search";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navigation = useMemo(() => {
    return isAdmin ? [...BASE_NAV, ADMIN_NAV] : [...BASE_NAV];
  }, [isAdmin]);

  const activeNavItem = useMemo(() => {
    return (
      navigation.find((item) => {
        if (item.href === "/search") {
          return pathname === "/" || pathname.startsWith("/search");
        }
        if (item.href === "/admin/lexybrain") {
          return pathname.startsWith("/admin");
        }
        return pathname.startsWith(item.href);
      }) ?? navigation[0]
    );
  }, [navigation, pathname]);

  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar
          items={navigation}
          activePath={pathname}
          openOnMobile={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        <div className="flex min-h-screen flex-1 flex-col md:pl-64">
          <Topbar
            activeNavItem={activeNavItem}
            onToggleSidebar={() => setMobileNavOpen((open) => !open)}
          />
          <main className="flex-1 overflow-y-auto px-6 py-8 sm:px-8">
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
