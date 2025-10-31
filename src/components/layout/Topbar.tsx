"use client";

import Link from "next/link";

import { UserMenu } from "./UserMenu";
import { ui } from "@/ui/theme";
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
  const environmentLabel =
    process.env.NEXT_PUBLIC_ENVIRONMENT ?? process.env.NODE_ENV ?? "production";

  const menuLabel = navOpen ? "Hide navigation" : "Show navigation";
  const collapseLabel = sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <header className="app-header" style={{ background: "var(--color-header-bg, " + ui.colors.surface + ")" }}>
      <div className="app-header-left">
        <button
          type="button"
          className={`app-header-trigger ${isMobile ? "app-header-trigger-mobile" : ""}`}
          onClick={isMobile ? onToggleNav : onToggleSidebar}
          aria-expanded={isMobile ? navOpen : !sidebarCollapsed}
          aria-label={isMobile ? menuLabel : collapseLabel}
        >
          {isMobile ? "Menu" : sidebarCollapsed ? "Expand" : "Collapse"}
        </button>
        <div className="app-header-meta">
          <span className="app-header-eyebrow">LexyHub Control Center</span>
          <h1 className="app-header-title">{activeNavItem.label}</h1>
          <p className="app-header-description">{activeNavItem.description}</p>
        </div>
      </div>
      <div className="app-header-right">
        <span className="environment-pill">
          <span className="environment-indicator" /> {environmentLabel}
        </span>
        <Link href="/docs" className="app-header-help">
          Need help?
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
