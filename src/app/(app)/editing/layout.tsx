import { ReactNode } from "react";
import { EditingNav } from "@/components/editing/EditingNav";

/**
 * Editing Suite Layout
 *
 * Shared layout wrapper for all editing suite pages.
 * Provides:
 * - Hero header with suite description
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
 * @returns {JSX.Element} Layout with header, navigation, and children
 */
export default function EditingLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="editing-layout">
      <header className="editing-hero surface-card">
        <div>
          <h1>Etsy editing suite</h1>
          <p>
            Score listings, track competitors, and repair tag health without leaving the Lexy editing workspace. The tools below are
            wired into Supabase so audit history and insights stay audit-ready.
          </p>
        </div>
      </header>
      <EditingNav />
      <div className="editing-content">{children}</div>
    </div>
  );
}
