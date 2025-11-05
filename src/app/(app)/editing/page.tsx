import Link from "next/link";
import { Metadata } from "next";
import { FileSearch, Users, Tag } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Editing Suite | Lexy",
  description: "Comprehensive Etsy listing optimization tools with AI-powered insights for listing intelligence, competitor analysis, and tag optimization.",
};

/**
 * Editing Suite Overview Page
 *
 * Displays the main dashboard for the editing suite with three primary tools:
 * - Listing Intelligence: Quality audits for listings
 * - Competitor Analysis: Market benchmarking and insights
 * - Tag Optimizer: Data-driven tag recommendations
 *
 * @returns {JSX.Element} Overview dashboard with feature cards
 */
export default function EditingOverviewPage(): JSX.Element {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Editing Suite</CardTitle>
          <CardDescription className="text-base">
            Comprehensive tools for optimizing your Etsy listings with AI-powered insights and recommendations.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" />
              <CardTitle>Listing Intelligence</CardTitle>
            </div>
            <CardDescription>
              Quality audits for sentiment, tone, keyword gaps, and missing attributes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Quality scoring tuned for Etsy metadata</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Auto-detected attribute gaps with quick fixes</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Keyword density heatmap to drive copy edits</span>
              </li>
            </ul>
            <Button asChild className="w-full">
              <Link href="/editing/listing-intelligence">Open Tool</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Competitor Analysis</CardTitle>
            </div>
            <CardDescription>
              Benchmark keywords and shops across pricing, reviews, and tag overlap
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Ranks by estimated sales and review power</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Highlights shared phrases and tone clusters</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Visualizes saturation with strong vs. weak listings</span>
              </li>
            </ul>
            <Button asChild className="w-full">
              <Link href="/editing/competitor-analysis">Open Tool</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <CardTitle>Tag Optimizer</CardTitle>
            </div>
            <CardDescription>
              Blend keyword database with listing tags to find better alternatives
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Scores each tag with volume, trend, and competition data</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Suggests replacements that meaningfully lift demand</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Stores run history so editors can track progress</span>
              </li>
            </ul>
            <Button asChild className="w-full">
              <Link href="/editing/tag-optimizer">Open Tool</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
