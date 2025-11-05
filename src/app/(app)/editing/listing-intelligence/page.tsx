import { Metadata } from "next";
import { ListingIntelligenceForm } from "@/components/editing/ListingIntelligenceForm";

export const metadata: Metadata = {
  title: "Listing Intelligence | Editing Suite",
  description: "AI-powered quality audits analyzing sentiment, tone, readability, keyword density, and listing completeness for Etsy optimization.",
};

/**
 * Listing Intelligence Tool Page
 *
 * Provides AI-powered quality analysis for Etsy listings including:
 * - Completeness scoring
 * - Sentiment and tone analysis
 * - Readability metrics (Flesch reading ease)
 * - Keyword density analysis
 * - Quick fix recommendations
 *
 * @returns {JSX.Element} Listing intelligence form and results
 */
export default function ListingIntelligencePage(): JSX.Element {
  return (
    <div className="editing-tool">
      <ListingIntelligenceForm />
    </div>
  );
}
