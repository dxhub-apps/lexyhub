"use client";

import { useMemo } from "react";
import { Menu, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "./UserMenu";
import type { SidebarNavItem } from "./Sidebar";

type TopbarProps = {
  isMobile: boolean;
  navOpen: boolean;
  onToggleNav: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  activeNavItem: SidebarNavItem;
};

export function Topbar({
  isMobile,
  navOpen,
  onToggleNav,
  onToggleSidebar,
  sidebarCollapsed,
  activeNavItem,
}: TopbarProps): JSX.Element {
  const environmentLabel = useMemo(
    () => process.env.NEXT_PUBLIC_ENVIRONMENT ?? process.env.NODE_ENV ?? "production",
    [],
  );

  const handleToggle = () => {
    if (isMobile) {
      onToggleNav();
    } else {
      onToggleSidebar();
    }
  };

  return (
    <header
      className={cn(
        "fixed top-0 z-30 w-full bg-background border-b border-border transition-all duration-200",
        sidebarCollapsed && !isMobile ? "left-16" : "left-64",
        isMobile && "left-0"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            aria-expanded={isMobile ? navOpen : !sidebarCollapsed}
            aria-label={isMobile ? (navOpen ? "Close menu" : "Open menu") : (sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar")}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">
              {activeNavItem.label}
            </h1>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {activeNavItem.description}
            </span>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="View notifications"
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {/* Notification badge - only show if there are notifications */}
            {/* <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" /> */}
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <UserMenu environmentLabel={environmentLabel} />
        </div>
      </div>
    </header>
  );
}
