import Link from "next/link";
import { Metadata } from "next";
import { FileSearch, Users, Tag } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Etsy Suite | Lexy",
  description: "Comprehensive Etsy listing optimization tools with AI-powered insights for listing intelligence, competitor analysis, and tag optimization.",
};

/**
 * Etsy Suite Overview Page
 *
 * Displays the main dashboard for the Etsy Suite with three primary tools:
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
          <CardTitle className="text-3xl font-bold">Etsy Suite</CardTitle>
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
              Get instant quality scores for your Etsy listings with actionable improvement suggestions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Analyze sentiment, tone, and keyword usage</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Identify missing attributes and opportunities</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Visualize keyword density across your content</span>
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
              Compare your listings against competitors to discover winning strategies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>See how competitors rank by sales and reviews</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Discover successful keywords and phrases</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Understand market saturation and opportunities</span>
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
              Discover better tags to increase your listing visibility and sales
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Get search volume and trend data for each tag</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Find high-performing alternative tags</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Track your optimization history over time</span>
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
