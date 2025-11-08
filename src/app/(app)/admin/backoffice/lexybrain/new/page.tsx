"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PromptType = "market_brief" | "radar" | "ad_insight" | "risk" | "global";

const TYPE_OPTIONS: { value: PromptType; label: string; description: string }[] = [
  {
    value: "market_brief",
    label: "Market Brief",
    description: "Daily market analysis with opportunities and risks",
  },
  {
    value: "radar",
    label: "Opportunity Radar",
    description: "Opportunity detection and scoring",
  },
  {
    value: "ad_insight",
    label: "Ad Insights",
    description: "Keyword and advertising recommendations",
  },
  {
    value: "risk",
    label: "Risk Sentinel",
    description: "Risk detection and alerts",
  },
  {
    value: "global",
    label: "Global",
    description: "Global system instructions for all types",
  },
];

const DEFAULT_CONSTRAINTS: Record<PromptType, Record<string, unknown>> = {
  market_brief: {
    max_opportunities: 5,
    max_risks: 3,
    max_actions: 5,
    min_confidence: 0.7,
  },
  radar: {
    max_items: 10,
    score_range: [0, 1],
    require_comment: true,
  },
  ad_insight: {
    max_terms: 8,
    min_daily_cents: 100,
    max_daily_cents: 50000,
  },
  risk: {
    max_alerts: 5,
    severity_levels: ["low", "medium", "high"],
  },
  global: {},
};

export default function NewPromptConfigPage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<PromptType>("market_brief");
  const [systemInstructions, setSystemInstructions] = useState("");
  const [constraints, setConstraints] = useState(JSON.stringify(DEFAULT_CONSTRAINTS.market_brief, null, 2));
  const [isActive, setIsActive] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleTypeChange = (newType: PromptType) => {
    setType(newType);
    // Update constraints to match the new type
    setConstraints(JSON.stringify(DEFAULT_CONSTRAINTS[newType], null, 2));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    } else if (name.length > 100) {
      newErrors.name = "Name must be 100 characters or less";
    }

    if (!systemInstructions.trim()) {
      newErrors.systemInstructions = "System instructions are required";
    } else if (systemInstructions.length < 10) {
      newErrors.systemInstructions = "System instructions must be at least 10 characters";
    }

    try {
      JSON.parse(constraints);
    } catch {
      newErrors.constraints = "Constraints must be valid JSON";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast({
        title: "Validation failed",
        description: "Please fix the errors before saving",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/lexybrain/configs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": "admin",
        },
        body: JSON.stringify({
          name: name.trim(),
          type,
          system_instructions: systemInstructions.trim(),
          constraints: JSON.parse(constraints),
          is_active: isActive,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: unknown };
        throw new Error(payload.error ?? "Failed to create config");
      }

      toast({
        title: "Config created",
        description: `${name} has been created successfully.`,
        variant: "success",
      });

      router.push("/admin/backoffice/lexybrain");
    } catch (error) {
      console.error("Failed to create config", error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedType = TYPE_OPTIONS.find((opt) => opt.value === type);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold">New Prompt Configuration</CardTitle>
              <CardDescription className="text-base">Create a new LexyBrain prompt configuration</CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link href="/admin/backoffice/lexybrain">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Enhanced Market Brief v2"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">
              Type <span className="text-destructive">*</span>
            </Label>
            <Select value={type} onValueChange={(value) => handleTypeChange(value as PromptType)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && (
              <p className="text-sm text-muted-foreground">{selectedType.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="system_instructions">
              System Instructions <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="system_instructions"
              value={systemInstructions}
              onChange={(e) => setSystemInstructions(e.target.value)}
              placeholder="Enter the system instructions for the LLM..."
              className={`min-h-[200px] font-mono text-sm ${errors.systemInstructions ? "border-destructive" : ""}`}
            />
            {errors.systemInstructions && (
              <p className="text-sm text-destructive">{errors.systemInstructions}</p>
            )}
            <p className="text-sm text-muted-foreground">
              These instructions guide the LLM behavior for this prompt type.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="constraints">Constraints (JSON)</Label>
            <Textarea
              id="constraints"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="{}"
              className={`min-h-[150px] font-mono text-sm ${errors.constraints ? "border-destructive" : ""}`}
            />
            {errors.constraints && <p className="text-sm text-destructive">{errors.constraints}</p>}
            <p className="text-sm text-muted-foreground">
              Define output constraints and validation rules as JSON.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Set as Active</Label>
              <p className="text-sm text-muted-foreground">
                Make this the active configuration for {selectedType?.label}
                {isActive && " (will deactivate other configs of this type)"}
              </p>
            </div>
            <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" asChild disabled={saving}>
              <Link href="/admin/backoffice/lexybrain">Cancel</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Creating..." : "Create Config"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
