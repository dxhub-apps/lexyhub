import { Metadata } from "next";
import { TagOptimizerForm } from "@/components/editing/TagOptimizerForm";

export const metadata: Metadata = {
  title: "Tag Optimizer | Editing Suite",
  description: "Data-driven tag optimization using search volume, trend analysis, and competition metrics for better Etsy visibility.",
};

/**
 * Tag Optimizer Tool Page
 *
 * Evaluates and optimizes listing tags using:
 * - Search volume analysis
 * - Trend momentum scoring
 * - Competition metrics
 * - Duplicate detection
 * - Smart replacement recommendations
 * - Gap analysis for missing high-value tags
 *
 * @returns {JSX.Element} Tag optimizer form and diagnostics
 */
export default function TagOptimizerPage(): JSX.Element {
  return (
    <div className="editing-tool">
      <TagOptimizerForm />
    </div>
  );
}
