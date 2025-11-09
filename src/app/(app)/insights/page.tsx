"use client";

export const dynamic = 'force-dynamic';

import { Brain, Network, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NeuralMap } from "@/components/lexybrain/NeuralMap";
import { XRayDashboard } from "@/components/lexybrain/XRayDashboard";
import { GuideModal } from "@/components/lexybrain/GuideModal";

export default function InsightsPage() {
  const [neuralMapTerm, setNeuralMapTerm] = useState("handmade jewelry");
  const [neuralMapMarket, setNeuralMapMarket] = useState("etsy");
  const [showNeuralMap, setShowNeuralMap] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Load persisted search from Keyword Analysis tab
  useEffect(() => {
    const stored = localStorage.getItem("lexybrain_last_search");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.keyword) {
          setNeuralMapTerm(parsed.keyword);
          setNeuralMapMarket(parsed.market || "etsy");
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero Section - Compact with Guide Button */}
      <Card className="bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-cyan-500/10 border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              <CardTitle className="text-xl font-bold">LexyBrain AI Insights</CardTitle>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-xs">
                AI-Powered
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-2"
            >
              <HelpCircle className="h-4 w-4" />
              User Guide
            </Button>
          </div>
          <CardDescription className="text-sm mt-1">
            Complete market intelligence in one click - powered by Llama-3-8B
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Main Tabs - Simplified to 2 */}
      <Tabs defaultValue="keyword-analysis" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="keyword-analysis" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Keyword Analysis
          </TabsTrigger>
          <TabsTrigger value="neural-map" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Neural Map
          </TabsTrigger>
        </TabsList>

        {/* Keyword Analysis Tab (formerly X-Ray) */}
        <TabsContent value="keyword-analysis" className="space-y-6">
          <XRayDashboard />
        </TabsContent>

        {/* Neural Map Tab */}
        <TabsContent value="neural-map" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Keyword Similarity Search</CardTitle>
              <CardDescription>
                Enter a keyword to visualize its semantic connections in the marketplace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label htmlFor="neural-term">Keyword</Label>
                  <Input
                    id="neural-term"
                    placeholder="e.g., handmade jewelry"
                    value={neuralMapTerm}
                    onChange={(e) => setNeuralMapTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setShowNeuralMap(true);
                      }
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="neural-market">Market</Label>
                  <Input
                    id="neural-market"
                    placeholder="e.g., etsy"
                    value={neuralMapMarket}
                    onChange={(e) => setNeuralMapMarket(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setShowNeuralMap(true);
                      }
                    }}
                  />
                </div>
              </div>
              <Button
                className="mt-4"
                onClick={() => setShowNeuralMap(true)}
              >
                <Network className="h-4 w-4 mr-2" />
                Generate Neural Map
              </Button>
            </CardContent>
          </Card>

          {showNeuralMap && (
            <NeuralMap
              term={neuralMapTerm}
              market={neuralMapMarket}
              onAddToWatchlist={(term) => {
                // TODO: Implement add to watchlist
                console.log('Add to watchlist:', term);
              }}
              onAnalyzeCluster={(terms) => {
                // TODO: Implement cluster analysis
                console.log('Analyze cluster:', terms);
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Guide Modal */}
      <GuideModal open={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}
