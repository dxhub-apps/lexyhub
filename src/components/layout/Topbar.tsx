"use client";

import Link from "next/link";
import { useMemo } from "react";

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

  const menuLabel = navOpen ? "Hide navigation" : "Show navigation";
  const collapseLabel = sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";

  const handleToggle = () => {
    if (isMobile) {
      onToggleNav();
    } else {
      onToggleSidebar();
    }
  };

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-left">
          <button
            type="button"
            className="app-header-trigger"
            onClick={handleToggle}
            aria-expanded={isMobile ? navOpen : !sidebarCollapsed}
            aria-label={isMobile ? menuLabel : collapseLabel}
          >
            {isMobile ? (navOpen ? "Close" : "Menu") : sidebarCollapsed ? "Expand" : "Collapse"}
          </button>
          <div className="app-header-brand">
            <span className="app-header-brand-name">LexyHub</span>
            <span className="app-header-active">
              {activeNavItem.label} · {activeNavItem.description}
            </span>
          </div>
          <div className="app-header-search">
            <label htmlFor="global-search" className="sr-only">
              Global search
            </label>
            <input
              id="global-search"
              type="search"
              placeholder="Search keywords, watchlists, commands"
              aria-label="Search LexyHub"
            />
          </div>
        </div>
        <div className="app-header-right">
          <div className="app-header-plan">
            <strong>Growth Scale Plan</strong>
            <span>Workspace · Core Market</span>
          </div>
          <span className="environment-pill">
            <span className="environment-indicator" aria-hidden="true" />
            {environmentLabel}
          </span>
          <Link href="/docs" className="app-header-help">
            Docs &amp; help
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
