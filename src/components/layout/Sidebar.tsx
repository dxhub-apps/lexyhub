"use client";

import { type ReactNode } from "react";
import Link from "next/link";

export type SidebarNavItem = {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
};

type SidebarProps = {
  navItems: readonly SidebarNavItem[];
  pathname: string;
  collapsed: boolean;
  isMobile: boolean;
  navOpen: boolean;
  onToggleCollapse: () => void;
  onDismissMobile: () => void;
};

const NAV_TITLE = "LexyHub";
const NAV_TAGLINE = "Keyword intelligence";

export function Sidebar({
  navItems,
  pathname,
  collapsed,
  isMobile,
  navOpen,
  onToggleCollapse,
  onDismissMobile,
}: SidebarProps): JSX.Element {
  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname.startsWith("/dashboard");
    }
    if (href === "/admin/backoffice") {
      return pathname.startsWith("/admin/backoffice");
    }
    return pathname.startsWith(href);
  };

  const groups: Array<{ title: string; items: SidebarNavItem[] }> = [
    { title: "Core", items: navItems.slice(0, 5) as SidebarNavItem[] },
    { title: "Operations", items: navItems.slice(5) as SidebarNavItem[] },
  ].filter((group) => group.items.length > 0);

  return (
    <aside
      className={[
        "app-sidebar",
        collapsed ? "app-sidebar-collapsed" : "",
        isMobile ? "app-sidebar-mobile" : "",
        navOpen ? "app-sidebar-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Primary navigation"
    >
      <div className="app-sidebar-header">
        <div className="app-sidebar-brand">
          <span className="app-sidebar-title">{NAV_TITLE}</span>
          {!collapsed ? <span className="app-sidebar-tagline">{NAV_TAGLINE}</span> : null}
        </div>
        {isMobile ? (
          <button
            type="button"
            className="app-sidebar-action"
            aria-label="Close navigation"
            onClick={onDismissMobile}
          >
            Close
          </button>
        ) : (
          <button
            type="button"
            className="app-sidebar-action"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapse}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        )}
      </div>
      {!collapsed ? (
        <p className="app-sidebar-summary">Monitor usage, insights, and watchlists from a single command center.</p>
      ) : null}
      <nav className="app-sidebar-nav">
        {groups.map((group) => (
          <div key={group.title} className="app-sidebar-group">
            {!collapsed ? <span className="app-sidebar-group-title">{group.title}</span> : null}
            <div className="app-sidebar-links">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const ariaLabel = collapsed ? item.label : undefined;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "app-sidebar-link",
                      active ? "app-sidebar-link-active" : "",
                      collapsed ? "app-sidebar-link-collapsed" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-current={active ? "page" : undefined}
                    aria-label={ariaLabel}
                    onClick={isMobile ? onDismissMobile : undefined}
                  >
                    <span className="app-sidebar-link-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="app-sidebar-link-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {!collapsed ? (
        <footer className="app-sidebar-footer">
          <div className="app-sidebar-upgrade">
            <h3>Upgrade workspace</h3>
            <p>Extend keyword quotas and unlock advanced market simulations.</p>
            <Link href="/settings" className="app-sidebar-upgrade-link">
              Manage plan
            </Link>
          </div>
        </footer>
      ) : null}
    </aside>
  );
}
