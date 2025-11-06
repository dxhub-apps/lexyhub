"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navigation item configuration
 */
type NavItem = {
  href: string;
  label: string;
  description: string;
};

/**
 * Etsy Suite navigation items
 *
 * Defines the primary navigation structure for the Etsy Suite.
 * Each item includes:
 * - href: Route path
 * - label: Display name
 * - description: Short descriptor for context
 */
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/editing", label: "Overview", description: "All tools" },
  { href: "/editing/listing-intelligence", label: "Listing Intelligence", description: "Quality scores" },
  { href: "/editing/competitor-analysis", label: "Competitor Analysis", description: "Market insights" },
  { href: "/editing/tag-optimizer", label: "Tag Optimizer", description: "Better tags" },
] as const;

/**
 * EditingNav Component
 *
 * Client-side navigation for the Etsy Suite that tracks the current route
 * and highlights the active tab. Uses Next.js usePathname hook for routing.
 *
 * Features:
 * - Active state tracking via pathname comparison
 * - Accessible navigation with semantic HTML
 * - Two-line layout with label and description
 * - Responsive design via CSS classes
 *
 * Styling: Uses `.editing-nav*` classes from globals.css
 *
 * @returns {JSX.Element} Navigation bar with active state
 */
export function EditingNav(): JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="editing-nav" role="navigation" aria-label="Etsy suite navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`editing-nav-item${isActive ? " editing-nav-item--active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="flex flex-col">
              <span className="editing-nav-item-label">{item.label}</span>
              <span className="editing-nav-item-description">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
