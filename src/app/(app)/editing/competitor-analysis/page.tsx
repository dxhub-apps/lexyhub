import { Metadata } from "next";
import { CompetitorAnalysisForm } from "@/components/editing/CompetitorAnalysisForm";

export const metadata: Metadata = {
  title: "Competitor Analysis | Editing Suite",
  description: "Market benchmarking tool for Etsy with pricing intelligence, tag overlap analysis, and competitive insights.",
};

/**
 * Competitor Analysis Tool Page
 *
 * Provides comprehensive market intelligence including:
 * - Pricing quartiles and statistics
 * - Review and rating analysis
 * - Tag overlap detection
 * - Common phrase extraction
 * - Competitor ranking by composite score
 * - Strategic narrative recommendations
 *
 * @returns {JSX.Element} Competitor analysis form and insights
 */
export default function CompetitorAnalysisPage(): JSX.Element {
  return (
    <div className="editing-tool">
      <CompetitorAnalysisForm />
    </div>
  );
}
