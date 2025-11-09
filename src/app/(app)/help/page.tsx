"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Search, Heart, MessageSquare, FileText, Settings, Shield } from "lucide-react";

export default function HelpPage(): JSX.Element {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">LexyHub User Guide</h1>
        <p className="text-muted-foreground mt-2">
          Everything you need to know about using LexyHub for keyword intelligence
        </p>
      </div>

      <div className="space-y-6">
        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Getting Started
            </CardTitle>
            <CardDescription>Quick start guide for new users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Search for Keywords</h3>
              <p className="text-sm text-muted-foreground">
                Use the Search page to discover high-potential keywords for your marketplace products. Our AI-powered
                search analyzes demand, competition, and trends to help you find opportunities.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2. Build Your Watchlist</h3>
              <p className="text-sm text-muted-foreground">
                Add keywords to your watchlist to monitor their performance over time. Set up alerts to get notified
                when metrics change significantly.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3. Ask LexyBrain</h3>
              <p className="text-sm text-muted-foreground">
                Get AI-powered insights and recommendations by chatting with LexyBrain, your intelligent keyword
                assistant.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Search Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Keyword Search
            </CardTitle>
            <CardDescription>How to find and analyze keywords</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Search Methods</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Enter a keyword or phrase to discover related opportunities</li>
                <li>Use the keyboard shortcut <Badge variant="outline">/</Badge> to quickly focus the search bar</li>
                <li>Navigate results with <Badge variant="outline">↑↓</Badge> arrow keys</li>
                <li>Press <Badge variant="outline">Enter</Badge> to view detailed insights</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Understanding Metrics</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li><strong>Demand Index:</strong> Measures search volume and consumer interest</li>
                <li><strong>Competition Score:</strong> Indicates how saturated the market is</li>
                <li><strong>Trend Momentum:</strong> Shows whether interest is growing or declining</li>
                <li><strong>AI Opportunity:</strong> Our composite score for overall potential</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Watchlist Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Watchlist Management
            </CardTitle>
            <CardDescription>Track and monitor your favorite keywords</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Adding Keywords</h3>
              <p className="text-sm text-muted-foreground">
                Click the heart icon next to any keyword in search results to add it to your watchlist. You can add
                custom notes and set alert thresholds for each keyword.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Alert Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Set custom alert thresholds to get notified when metrics change by a specific percentage. Alerts help
                you stay on top of market shifts and trending opportunities.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* LexyBrain Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Ask LexyBrain
            </CardTitle>
            <CardDescription>AI-powered keyword intelligence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">What You Can Ask</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Get keyword suggestions for specific niches or products</li>
                <li>Analyze market trends and seasonal patterns</li>
                <li>Compare keywords and identify the best opportunities</li>
                <li>Get strategic advice for your marketplace business</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Best Practices</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Be specific about your niche and target market</li>
                <li>Ask follow-up questions to dive deeper into insights</li>
                <li>Reference specific keywords from your watchlist</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Reports
            </CardTitle>
            <CardDescription>Automated insights and briefs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Weekly Reports</h3>
              <p className="text-sm text-muted-foreground">
                Receive automated weekly reports summarizing keyword performance, trending opportunities, and market
                insights based on your watchlist.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Monthly Briefs</h3>
              <p className="text-sm text-muted-foreground">
                Get comprehensive monthly briefs with deep-dive analysis, seasonal trends, and strategic
                recommendations for the upcoming month.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Account Settings
            </CardTitle>
            <CardDescription>Manage your profile and preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Profile Management</h3>
              <p className="text-sm text-muted-foreground">
                Update your profile information, avatar, and company details from the Profile page accessible via the
                user menu.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Billing & Subscription</h3>
              <p className="text-sm text-muted-foreground">
                View your current plan, usage quotas, and manage your subscription from the Billing page. Upgrade or
                downgrade your plan as your needs change.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Notification Preferences</h3>
              <p className="text-sm text-muted-foreground">
                Configure your notification settings to control email alerts, in-app notifications, and report
                delivery preferences.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <Card>
          <CardHeader>
            <CardTitle>Need More Help?</CardTitle>
            <CardDescription>Get in touch with our support team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you have questions or need assistance, our support team is here to help:
            </p>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Email:</strong>{" "}
                <a href="mailto:support@lexyhub.com" className="text-blue-600 hover:underline">
                  support@lexyhub.com
                </a>
              </div>
              <div>
                <strong>Response Time:</strong> Within 24 hours on business days
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
