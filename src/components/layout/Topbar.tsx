"use client";

import Link from "next/link";

import { UserMenu } from "./UserMenu";
import { ui } from "@/ui/theme";

export type NavItem = {
  href: string;
  label: string;
  description: string;
};

type TopbarProps = {
  navItems: readonly NavItem[];
  pathname: string;
  isMobile: boolean;
  navOpen: boolean;
  onToggleNav: () => void;
};

export function Topbar({ navItems, pathname, isMobile, navOpen, onToggleNav }: TopbarProps): JSX.Element {
  const environmentLabel =
    process.env.NEXT_PUBLIC_ENVIRONMENT ?? process.env.NODE_ENV ?? "production";

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
    <header className="topbar" style={{ background: "var(--surface-overlay, " + ui.colors.surface + ")" }}>
      <div className="topbar-inner">
        <div className="topbar-left">
          <span className="topbar-brand">LexyHub Control Center</span>
          {isMobile ? (
            <button
              type="button"
              className="topbar-nav-toggle"
              aria-expanded={navOpen}
              aria-label={navOpen ? "Hide navigation" : "Show navigation"}
              aria-controls="topbar-nav"
              onClick={onToggleNav}
            >
              Menu
            </button>
          ) : null}
          <nav
            className={`topbar-nav${isMobile ? " topbar-nav-mobile" : ""}`}
            data-open={navOpen || !isMobile}
            aria-label="Primary navigation"
            id="topbar-nav"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`topbar-nav-link${isActive(item.href) ? " topbar-nav-link-active" : ""}`}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="topbar-right">
          <span className="environment-pill">
            <span className="environment-indicator" /> Environment: {environmentLabel}
          </span>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
