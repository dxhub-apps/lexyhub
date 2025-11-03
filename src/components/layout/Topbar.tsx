"use client";

import { useMemo } from "react";

import { UserMenu } from "./UserMenu";
import type { SidebarNavItem } from "./Sidebar";

function NotificationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      width={20}
      height={20}
      className="app-header-action-icon"
    >
      <path
        fill="currentColor"
        d="M12 2a6 6 0 0 0-6 6v2.35c0 .51-.2 1-.55 1.36l-.93.93A1 1 0 0 0 5.17 14H19a1 1 0 0 0 .7-1.7l-.93-.93a1.94 1.94 0 0 1-.55-1.35V8a6 6 0 0 0-6-6m0 20a3 3 0 0 0 3-3h-6a3 3 0 0 0 3 3"
      />
    </svg>
  );
}

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
        </div>
        <div className="app-header-right">
          <div className="app-header-actions">
            <button type="button" className="app-header-action" aria-label="View notifications">
              <NotificationIcon />
              <span className="sr-only">Open notifications</span>
            </button>
            <UserMenu environmentLabel={environmentLabel} />
          </div>
        </div>
      </div>
    </header>
  );
}
