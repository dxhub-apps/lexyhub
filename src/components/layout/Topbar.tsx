"use client";

import { Menu } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { SidebarNavItem } from "./Sidebar";
import { UserMenu } from "./UserMenu";

type TopbarProps = {
  activeNavItem: SidebarNavItem;
  onToggleSidebar: () => void;
};

export function Topbar({ activeNavItem, onToggleSidebar }: TopbarProps): JSX.Element {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <span className="text-sm font-medium uppercase tracking-wide text-foreground">{activeNavItem.description}</span>
            <h1 className="text-lg font-semibold">{activeNavItem.label}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="accent" size="sm">
            <Link href="/ask-lexybrain">Ask LexyBrain</Link>
          </Button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
