"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ADMIN_SECTIONS = [
  {
    href: "/admin/lexybrain",
    label: "LexyBrain Prompts",
    description: "Manage AI prompt configurations",
  },
  {
    href: "/admin/feedback",
    label: "Feedback",
    description: "Review user suggestions and issues",
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    description: "Broadcast updates to users",
  },
] as const;

export function AdminNavigation(): JSX.Element {
  const pathname = usePathname();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {ADMIN_SECTIONS.map((section) => {
          const isActive = pathname?.startsWith(section.href) ?? false;

          return (
            <Link
              key={section.href}
              href={section.href}
              className={cn(
                buttonVariants({
                  variant: isActive ? "default" : "ghost",
                  size: "sm",
                }),
                "justify-start",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {section.label}
            </Link>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        {ADMIN_SECTIONS.find((section) => pathname?.startsWith(section.href))?.description ??
          "Administer LexyHub experiences and system settings."}
      </p>
    </div>
  );
}
