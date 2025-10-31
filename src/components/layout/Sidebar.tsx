"use client";

import Link from "next/link";

export type SidebarNavItem = {
  href: string;
  label: string;
  description: string;
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
const NAV_TAGLINE = "Growth intelligence";

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
      aria-label="Primary"
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
        <p className="app-sidebar-summary">Your command center for AI growth operations.</p>
      ) : null}
      <nav className="app-sidebar-nav">
        {navItems.map((item) => {
          const active = isActive(item.href);
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
              onClick={isMobile ? onDismissMobile : undefined}
            >
              <span className="app-sidebar-link-icon" aria-hidden="true">
                {item.label.slice(0, 2)}
              </span>
              <span className="app-sidebar-link-label">{item.label}</span>
              {!collapsed ? (
                <span className="app-sidebar-link-description">{item.description}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      {!collapsed ? (
        <footer className="app-sidebar-footer">
          <div className="app-sidebar-upgrade">
            <h3>Need more seats?</h3>
            <p>Upgrade your plan to unlock full market intelligence coverage.</p>
            <Link href="/settings" className="app-sidebar-upgrade-link">
              Manage plan
            </Link>
          </div>
        </footer>
      ) : null}
    </aside>
  );
}
