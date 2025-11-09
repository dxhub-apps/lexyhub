"use client";

import { Users, Info } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type KeywordDetails = {
  id?: string;
  term: string;
  market: string;
  source: string;
};

export function KeywordCompetitorsTab({ keyword }: { keyword: KeywordDetails }) {
  // Competitor intelligence will be added in future iterations
  // For now, show a placeholder indicating this feature is coming soon

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div className="space-y-1">
              <CardTitle>Competitor Intelligence</CardTitle>
              <CardDescription>
                Analyze competitors targeting &ldquo;{keyword.term}&rdquo;
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Feature Coming Soon</AlertTitle>
            <AlertDescription>
              Competitor intelligence for this keyword will be available once the core LexyBrain
              RAG foundation is stable. This will include:
              <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                <li>Top competing products and listings</li>
                <li>Price point analysis</li>
                <li>Review sentiment comparison</li>
                <li>Market share indicators</li>
                <li>Competitive positioning insights</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Placeholder for future competitor data */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="text-lg mb-2">No competitor data yet</CardTitle>
          <CardDescription>
            This feature is being built as part of the LexyHub keyword-first journey
          </CardDescription>
        </CardContent>
      </Card>
    </>
  );
}
