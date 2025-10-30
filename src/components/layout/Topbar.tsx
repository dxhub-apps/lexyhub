"use client";

import Link from "next/link";

import { UserMenu } from "./UserMenu";

type TopbarProps = {
  isMobile: boolean;
  isCollapsed: boolean;
  onToggleSidebar: () => void;
};

export function Topbar({ isMobile, isCollapsed, onToggleSidebar }: TopbarProps): JSX.Element {
  return (
    <header className="topbar">
      <div className="topbar-meta">
        <strong>LexyHub Control Center</strong>
        <span className="topbar-subtitle">Momentum-aware quotas &amp; watchlists</span>
      </div>
      <div className="topbar-actions">
        <Link href="/status" className="topbar-help-link" aria-label="View platform status">
          Status
        </Link>
        <span className="topbar-environment" aria-live="polite">
          Environment: {process.env.NODE_ENV}
        </span>
        <UserMenu />
        {isMobile ? (
          <button
            type="button"
            className="sidebar-toggle mobile"
            aria-label={isCollapsed ? "Open navigation" : "Hide navigation"}
            onClick={onToggleSidebar}
          >
            ☰
          </button>
        ) : null}
      </div>
    </header>
  );
}
