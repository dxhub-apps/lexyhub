"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type PromptType = "market_brief" | "radar" | "ad_insight" | "risk" | "global";

type PromptConfig = {
  id: string;
  name: string;
  type: PromptType;
  system_instructions: string;
  constraints: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const TYPE_LABELS: Record<PromptType, string> = {
  market_brief: "Market Brief",
  radar: "Opportunity Radar",
  ad_insight: "Ad Insights",
  risk: "Risk Sentinel",
  global: "Global",
};

export default function EditPromptConfigPage(): JSX.Element {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const configId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PromptConfig | null>(null);

  const [name, setName] = useState("");
  const [systemInstructions, setSystemInstructions] = useState("");
  const [constraints, setConstraints] = useState("");
  const [isActive, setIsActive] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/admin/lexybrain/configs", {
          headers: { "x-user-role": "admin" },
        });

        if (!response.ok) {
          throw new Error("Failed to load configs");
        }

        const payload = (await response.json()) as { configs: PromptConfig[] };
        const foundConfig = payload.configs.find((c) => c.id === configId);

        if (!foundConfig) {
          throw new Error("Config not found");
        }

        setConfig(foundConfig);
        setName(foundConfig.name);
        setSystemInstructions(foundConfig.system_instructions);
        setConstraints(JSON.stringify(foundConfig.constraints, null, 2));
        setIsActive(foundConfig.is_active);
      } catch (error) {
        console.error("Failed to load config", error);
        toast({
          title: "Failed to load config",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
        router.push("/admin/backoffice/lexybrain");
      } finally {
        setLoading(false);
      }
    };

    void loadConfig();
  }, [configId, router, toast]);

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
    if (!config) return;

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
      const updates: Record<string, unknown> = {
        id: config.id,
      };

      // Only include changed fields
      if (name.trim() !== config.name) {
        updates.name = name.trim();
      }
      if (systemInstructions.trim() !== config.system_instructions) {
        updates.system_instructions = systemInstructions.trim();
      }
      const parsedConstraints = JSON.parse(constraints);
      if (JSON.stringify(parsedConstraints) !== JSON.stringify(config.constraints)) {
        updates.constraints = parsedConstraints;
      }
      if (isActive !== config.is_active) {
        updates.is_active = isActive;
      }

      // If only id is present, nothing to update
      if (Object.keys(updates).length === 1) {
        toast({
          title: "No changes",
          description: "No changes to save.",
          variant: "default",
        });
        setSaving(false);
        return;
      }

      const response = await fetch("/api/admin/lexybrain/configs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": "admin",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: unknown };
        throw new Error(payload.error ?? "Failed to update config");
      }

      toast({
        title: "Config updated",
        description: `${name} has been updated successfully.`,
        variant: "success",
      });

      router.push("/admin/backoffice/lexybrain");
    } catch (error) {
      console.error("Failed to update config", error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Loading configuration...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="space-y-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Configuration not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-3xl font-bold">Edit Prompt Configuration</CardTitle>
                <Badge>{TYPE_LABELS[config.type]}</Badge>
              </div>
              <CardDescription className="text-base">
                Modify the configuration for {config.name}
              </CardDescription>
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
            <Label>Type</Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{TYPE_LABELS[config.type]}</Badge>
              <p className="text-sm text-muted-foreground">(Type cannot be changed after creation)</p>
            </div>
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
                Make this the active configuration for {TYPE_LABELS[config.type]}
                {isActive && !config.is_active && " (will deactivate other configs of this type)"}
              </p>
            </div>
            <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{new Date(config.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Updated</p>
                <p className="font-medium">{new Date(config.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" asChild disabled={saving}>
              <Link href="/admin/backoffice/lexybrain">Cancel</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
