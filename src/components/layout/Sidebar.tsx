"use client";

import Link from "next/link";
import Image from "next/image";
import { type LucideIcon, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";

export type SidebarNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type SidebarProps = {
  items: readonly SidebarNavItem[];
  activePath: string;
  openOnMobile: boolean;
  onCloseMobile: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export function Sidebar({
  items,
  activePath,
  openOnMobile,
  onCloseMobile,
  collapsed,
  onToggleCollapse
}: SidebarProps): JSX.Element {
  const { resolvedTheme } = useTheme();

  // Determine which logo to use
  const logoSrc = collapsed
    ? "/logos/lexyhub_icon.svg"
    : resolvedTheme === "dark"
      ? "/logos/Lexyhub_logo_white.svg"
      : "/logos/Lexyhub_logo_dark.svg";

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-background transition-all duration-200",
          collapsed ? "w-16" : "w-64",
          openOnMobile ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        <div className={cn(
          "flex h-16 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "px-6"
        )}>
          <Image
            src={logoSrc}
            alt="LexyHub Logo"
            width={collapsed ? 32 : 150}
            height={collapsed ? 32 : 40}
            className={cn(
              "object-contain",
              collapsed ? "w-8 h-8" : "h-8"
            )}
            priority
          />
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/search"
                  ? activePath === "/" || activePath.startsWith(item.href)
                  : activePath.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onCloseMobile}
                    className={cn(
                      "flex items-center border-l-4",
                      "text-sm font-medium transition-all",
                      collapsed ? "justify-center px-0 py-3" : "gap-3 px-6 py-3",
                      isActive ? "border-accent" : "border-transparent",
                      isActive ? "bg-secondary" : "hover:bg-secondary"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && (
                      <div className="flex flex-col">
                        <span>{item.label}</span>
                        <span className="text-xs text-foreground">{item.description}</span>
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse/Expand toggle button - Desktop only */}
        <div className={cn(
          "hidden md:flex border-t border-border",
          collapsed ? "justify-center p-2" : "justify-end p-4"
        )}>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-md p-2 hover:bg-secondary transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>
      </aside>

      {openOnMobile && (
        <button
          type="button"
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 block bg-background md:hidden"
          aria-label="Close navigation"
        />
      )}
    </>
  );
}
