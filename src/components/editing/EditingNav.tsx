"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/editing", label: "Overview", description: "Feature tour" },
  { href: "/editing/listing-intelligence", label: "Listing intelligence", description: "Scorecards" },
  { href: "/editing/competitor-analysis", label: "Competitor analysis", description: "Benchmark" },
  { href: "/editing/tag-optimizer", label: "Tag optimizer", description: "Search lift" },
];

export function EditingNav(): JSX.Element {
  const pathname = usePathname();
  return (
    <nav className="editing-nav">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} className={`editing-nav-item${active ? " editing-nav-item--active" : ""}`}>
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
