"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/theme/ThemeProvider";

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

export function Sidebar({
  navItems,
  pathname,
  collapsed,
  isMobile,
  navOpen,
  onToggleCollapse,
  onDismissMobile,
}: SidebarProps): JSX.Element {
  const { resolvedTheme } = useTheme();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname.startsWith("/dashboard");
    }
    if (href === "/admin/backoffice") {
      return pathname.startsWith("/admin/backoffice");
    }
    return pathname.startsWith(href);
  };

  // Separate admin items from regular navigation
  const adminItems = navItems.filter((item) => item.href.startsWith("/admin"));
  const regularItems = navItems.filter((item) => !item.href.startsWith("/admin"));

  const groups: Array<{ title: string; items: SidebarNavItem[] }> = [
    { title: "Navigation", items: regularItems as SidebarNavItem[] },
    ...(adminItems.length > 0 ? [{ title: "Admin", items: adminItems as SidebarNavItem[] }] : []),
  ].filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-background border-r border-border transition-all duration-200",
        collapsed && !isMobile ? "w-16" : "w-64",
        isMobile && !navOpen && "-translate-x-full",
        isMobile && navOpen && "translate-x-0 w-64"
      )}
      aria-label="Primary navigation"
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Image
                src={resolvedTheme === "dark" ? "/logos/Lexyhub_logo_white.svg" : "/logos/Lexyhub_logo_dark.svg"}
                alt="LexyHub"
                width={175}
                height={40}
                priority
                className="h-10 w-auto"
              />
            </Link>
          )}
          {collapsed && !isMobile && (
            <Link href="/dashboard" className="flex items-center justify-center w-full">
              <Image
                src="/logos/lexyhub_icon.svg"
                alt="LexyHub"
                width={40}
                height={40}
                priority
                className="h-10 w-10"
              />
            </Link>
          )}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className={cn("h-8 w-8", collapsed && "mx-auto")}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          )}
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismissMobile}
              aria-label="Close navigation"
            >
              Close
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
          {groups.map((group) => (
            <div key={group.title} className="space-y-1">
              {!collapsed && (
                <h4 className="px-2 text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                  {group.title}
                </h4>
              )}
              {collapsed && <Separator className="my-2" />}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={isMobile ? onDismissMobile : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-all duration-150 ease-in-out",
                        "hover:text-accent hover:bg-muted/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "text-foreground border-l-4 border-accent pl-1.5" : "text-foreground border-l-4 border-transparent",
                        collapsed && "justify-center"
                      )}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="flex items-center gap-3 w-full">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="truncate">{item.label}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </span>
                          </div>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer - Founders Deal CTA - NO GRADIENT */}
        {!collapsed && (
          <div className="p-4 border-t border-border">
            <div className="rounded-lg bg-accent border border-accent p-3 space-y-2 text-white">
              <h4 className="text-sm font-bold">Founders Deal — Limited Time</h4>
              <p className="text-xs">
                Unlock the LexyHub Basic Plan for only $39/year.
                More power. Less cost.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                asChild
              >
                <Link href="/billing?upgrade=founders">Upgrade now →</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
