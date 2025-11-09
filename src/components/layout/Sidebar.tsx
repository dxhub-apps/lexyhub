"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

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
};

export function Sidebar({ items, activePath, openOnMobile, onCloseMobile }: SidebarProps): JSX.Element {
  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-background transition-transform duration-200",
          openOnMobile ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center border-b border-border px-6 text-lg font-semibold">
          LexyHub
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
                      "flex items-center gap-3 border-l-4 px-6 py-3",
                      "text-sm font-medium",
                      isActive ? "border-accent" : "border-transparent",
                      isActive ? "bg-secondary" : "hover:bg-secondary"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      <span className="text-xs text-foreground">{item.description}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
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
