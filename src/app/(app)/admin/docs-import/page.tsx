"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileText, Download, Copy, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type Marketplace = "auto" | "etsy" | "amazon" | "other";

interface ImportResult {
  success: boolean;
  markdown?: string;
  suggestedPath?: string;
  stage?: string;
  message?: string;
}

export default function DocsImportPage() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [marketplace, setMarketplace] = useState<Marketplace>("auto");
  const [topicOverride, setTopicOverride] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleGenerate = async () => {
    if (!url.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/docs-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
          marketplace,
          topicOverride: topicOverride.trim() || undefined,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        toast({
          title: "Success",
          description: "Markdown generated successfully!",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: data.message || "Failed to generate markdown",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorResult: ImportResult = {
        success: false,
        stage: "client",
        message: error instanceof Error ? error.message : "Network error occurred",
      };
      setResult(errorResult);
      toast({
        title: "Error",
        description: "Failed to process request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMarkdown = async () => {
    if (result?.markdown) {
      try {
        await navigator.clipboard.writeText(result.markdown);
        toast({
          title: "Copied",
          description: "Markdown content copied to clipboard",
        });
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Failed to copy to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  const handleCopyPath = async () => {
    if (result?.suggestedPath) {
      try {
        await navigator.clipboard.writeText(result.suggestedPath);
        toast({
          title: "Copied",
          description: "Path copied to clipboard",
        });
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Failed to copy to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  const handleDownload = () => {
    if (result?.markdown && result?.suggestedPath) {
      // Extract filename from suggested path
      const filename = result.suggestedPath.split("/").pop() || "document.md";

      const blob = new Blob([result.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded",
        description: `File saved as ${filename}`,
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Documentation Import Tool
        </h1>
        <p className="text-muted-foreground mt-2">
          Convert public help/documentation URLs into clean, ingestion-ready Markdown for the
          LexyBrain RAG corpus
        </p>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle>Source Configuration</CardTitle>
          <CardDescription>
            Provide the URL and configuration for the documentation you want to import
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="url">Source URL *</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://help.etsy.com/hc/en-us/articles/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              The public URL of the help article or documentation page
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="marketplace">Marketplace</Label>
            <Select
              value={marketplace}
              onValueChange={(value) => setMarketplace(value as Marketplace)}
              disabled={loading}
            >
              <SelectTrigger id="marketplace">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="etsy">Etsy</SelectItem>
                <SelectItem value="amazon">Amazon</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Auto-detect will determine the marketplace from the URL hostname
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topicOverride">Topic Override (Optional)</Label>
            <Input
              id="topicOverride"
              type="text"
              placeholder="e.g., shipping-policies"
              value={topicOverride}
              onChange={(e) => setTopicOverride(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Override the auto-generated topic slug/filename
            </p>
          </div>

          <Button onClick={handleGenerate} disabled={loading || !url.trim()} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Markdown...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Markdown
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error Display */}
      {result && !result.success && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            Error at stage: {result.stage || "unknown"}
          </AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}

      {/* Success Display */}
      {result && result.success && (
        <>
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              Markdown generated successfully. Review the output below.
            </AlertDescription>
          </Alert>

          {/* Suggested Path */}
          <Card>
            <CardHeader>
              <CardTitle>Suggested File Path</CardTitle>
              <CardDescription>
                Use this path when saving the markdown file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm">
                  {result.suggestedPath}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyPath}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Markdown Output */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Markdown</CardTitle>
              <CardDescription>
                Clean, ingestion-ready markdown with metadata
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <pre className="max-h-[600px] overflow-auto rounded-lg bg-muted p-4 font-mono text-xs">
                  <code>{result.markdown}</code>
                </pre>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCopyMarkdown} className="flex-1">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Markdown
                </Button>
                <Button variant="outline" onClick={handleDownload} className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download .md
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">How to use this tool:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Paste a public help or documentation URL (Etsy, Amazon, etc.)</li>
              <li>Select the marketplace (or use auto-detect)</li>
              <li>Optionally provide a custom topic slug for the filename</li>
              <li>Click &quot;Generate Markdown&quot; to process the URL</li>
              <li>Review the generated markdown and suggested file path</li>
              <li>Copy the markdown or download the .md file</li>
              <li>Manually save the file to the suggested path under docs/public/</li>
              <li>Commit the file to git for RAG ingestion</li>
            </ol>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Output Structure:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Etsy docs → docs/public/etsy/&lt;topic&gt;.md</li>
              <li>Amazon docs → docs/public/amazon/&lt;topic&gt;.md</li>
              <li>Other docs → docs/public/other/&lt;topic&gt;.md</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Metadata Format:</h3>
            <p className="text-sm text-muted-foreground">
              Each generated markdown file includes a JSON metadata block with: marketplace, topic,
              source_url, source_type, language, docs_path, last_verified, and version.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
