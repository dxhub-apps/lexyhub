import { ReactNode } from "react";
import { EditingNav } from "@/components/editing/EditingNav";

/**
 * Etsy Suite Layout
 *
 * Shared layout wrapper for all Etsy Suite pages.
 * Provides:
 * - Contextual navigation via EditingNav
 * - Scoped `.editing-*` CSS classes for consistent styling
 *
 * This layout wraps:
 * - /editing (overview)
 * - /editing/listing-intelligence
 * - /editing/competitor-analysis
 * - /editing/tag-optimizer
 *
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child page content
 * @returns {JSX.Element} Layout with navigation and children
 */
export default function EditingLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="editing-layout">
      <EditingNav />
      <div className="editing-content">{children}</div>
    </div>
  );
}
