import { ReactNode } from "react";
import { EditingNav } from "@/components/editing/EditingNav";

/**
 * Etsy Suite Layout
 *
 * Shared layout wrapper for all Etsy Suite pages.
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
          <h1>Etsy Suite</h1>
          <p>
            Powerful tools to optimize your Etsy listings. Analyze quality, benchmark against competitors, and improve your tags
            with AI-powered insights. All your work is automatically saved for future reference.
          </p>
        </div>
      </header>
      <EditingNav />
      <div className="editing-content">{children}</div>
    </div>
  );
}
