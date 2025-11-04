"use client";

import { useEffect, useMemo, useState } from "react";
import { Flag } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type FeatureFlagKey = "require_official_etsy_api" | "allow_search_sampling" | "allow_user_telemetry";

type FeatureFlagMetadata = {
  label: string;
  description: string;
  helper?: string;
};

const FLAG_METADATA: Record<FeatureFlagKey, FeatureFlagMetadata> = {
  require_official_etsy_api: {
    label: "Require official Etsy API",
    description: "Run ingestion and sync jobs only when the official Etsy API is enabled.",
    helper: "Disable this to pause Etsy data ingestion during sandbox or maintenance windows.",
  },
  allow_search_sampling: {
    label: "Allow search sampling",
    description: "Enable the keyword SERP sampler to capture live Etsy search results.",
    helper: "Sampling respects keyword opt-in and watchlist prioritisation rules.",
  },
  allow_user_telemetry: {
    label: "Allow user telemetry",
    description: "Accept telemetry submissions and aggregate keyword performance stats.",
    helper: "When disabled, ingestion jobs and the API will reject telemetry payloads.",
  },
};

type FeatureFlagState = {
  key: FeatureFlagKey;
  isEnabled: boolean;
  saving: boolean;
};

type FeatureFlagResponse = {
  flags: Record<FeatureFlagKey, boolean>;
};

export default function FeatureFlagsPage(): JSX.Element {
  const { toast } = useToast();
  const [flags, setFlags] = useState<FeatureFlagState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/admin/feature-flags", { headers: { "x-user-role": "admin" } });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as Partial<FeatureFlagResponse> & {
            error?: string;
          };
          throw new Error(payload.error ?? `Unable to load feature flags (${response.status})`);
        }
        const payload = (await response.json()) as FeatureFlagResponse;
        if (!active) return;
        setFlags(
          (Object.entries(payload.flags) as Array<[FeatureFlagKey, boolean]>).map(([key, value]) => ({
            key,
            isEnabled: Boolean(value),
            saving: false,
          })),
        );
      } catch (error) {
        console.error("Failed to load feature flags", error);
        if (active) {
          toast({
            title: "Unable to load feature flags",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [toast]);

  const orderedFlags = useMemo(() => {
    return (Object.keys(FLAG_METADATA) as FeatureFlagKey[]).map((key) =>
      flags.find((flag) => flag.key === key) ?? { key, isEnabled: false, saving: false },
    );
  }, [flags]);

  const toggleFlag = async (key: FeatureFlagKey, nextValue: boolean) => {
    setFlags((prev) =>
      prev.map((flag) => (flag.key === key ? { ...flag, isEnabled: nextValue, saving: true } : flag)),
    );

    try {
      const response = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": "admin",
        },
        body: JSON.stringify({ key, is_enabled: nextValue }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `Unable to update ${key}`);
      }

      const payload = (await response.json()) as FeatureFlagResponse;
      setFlags(
        (Object.entries(payload.flags) as Array<[FeatureFlagKey, boolean]>).map(([flagKey, value]) => ({
          key: flagKey,
          isEnabled: Boolean(value),
          saving: false,
        })),
      );
      toast({
        title: "Feature flag updated",
        description: `${FLAG_METADATA[key].label} is now ${nextValue ? "enabled" : "disabled"}.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to update feature flag", error);
      setFlags((prev) =>
        prev.map((flag) => (flag.key === key ? { ...flag, isEnabled: !nextValue, saving: false } : flag)),
      );
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Flag className="h-6 w-6 text-muted-foreground" />
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold">Feature Flags</CardTitle>
              <CardDescription className="text-base">
                Toggle platform capabilities that rely on the official Etsy API, live search sampling, and telemetry ingestion.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6">
        {orderedFlags.map((flag) => {
          const metadata = FLAG_METADATA[flag.key];
          const isDisabled = loading || flag.saving;
          return (
            <Card key={flag.key}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={flag.key} className="text-base font-semibold cursor-pointer">
                        {metadata.label}
                      </Label>
                      <Badge variant={flag.isEnabled ? "default" : "secondary"}>
                        {flag.isEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                      {flag.saving && <Badge variant="outline">Saving...</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{metadata.description}</p>
                    {metadata.helper && (
                      <p className="text-xs text-muted-foreground italic">{metadata.helper}</p>
                    )}
                  </div>
                  <Switch
                    id={flag.key}
                    checked={flag.isEnabled}
                    onCheckedChange={(checked) => toggleFlag(flag.key, checked)}
                    disabled={isDisabled}
                    aria-label={metadata.label}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
