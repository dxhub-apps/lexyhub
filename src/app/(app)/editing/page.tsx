import Link from "next/link";
import { Metadata } from "next";
import { FileSearch, Users, Tag, ArrowRight, Sparkles, TrendingUp, Shield } from "lucide-react";
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
      {/* Hero Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-4xl font-bold">Etsy Suite</h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Powerful AI-powered tools to optimize your Etsy listings. Analyze quality, benchmark against competitors,
          and improve your tags with data-driven insights. All your work is automatically saved for future reference.
        </p>
      </div>

      {/* Tool Cards Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Listing Intelligence */}
        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <FileSearch className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Listing Intelligence</CardTitle>
            </div>
            <CardDescription className="text-base">
              Get instant quality scores for your Etsy listings with actionable improvement suggestions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Analyze sentiment, tone, and keyword usage</span>
              </li>
              <li className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Identify missing attributes and opportunities</span>
              </li>
              <li className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Visualize keyword density across your content</span>
              </li>
            </ul>
            <Button asChild className="w-full group-hover:bg-primary/90" size="lg">
              <Link href="/editing/listing-intelligence" className="flex items-center justify-center gap-2">
                Open Tool
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Competitor Analysis */}
        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Competitor Analysis</CardTitle>
            </div>
            <CardDescription className="text-base">
              Compare your listings against competitors to discover winning strategies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">See how competitors rank by sales and reviews</span>
              </li>
              <li className="flex items-start gap-3">
                <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Discover successful keywords and phrases</span>
              </li>
              <li className="flex items-start gap-3">
                <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Understand market saturation and opportunities</span>
              </li>
            </ul>
            <Button asChild className="w-full group-hover:bg-primary/90" size="lg">
              <Link href="/editing/competitor-analysis" className="flex items-center justify-center gap-2">
                Open Tool
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Tag Optimizer */}
        <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Tag className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Tag Optimizer</CardTitle>
            </div>
            <CardDescription className="text-base">
              Discover better tags to increase your listing visibility and sales
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Get search volume and trend data for each tag</span>
              </li>
              <li className="flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Find high-performing alternative tags</span>
              </li>
              <li className="flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Track your optimization history over time</span>
              </li>
            </ul>
            <Button asChild className="w-full group-hover:bg-primary/90" size="lg">
              <Link href="/editing/tag-optimizer" className="flex items-center justify-center gap-2">
                Open Tool
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
