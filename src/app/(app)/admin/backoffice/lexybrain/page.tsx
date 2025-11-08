"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Plus, Pencil, Trash2 } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PromptConfig = {
  id: string;
  name: string;
  type: "market_brief" | "radar" | "ad_insight" | "risk" | "global";
  system_instructions: string;
  constraints: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const TYPE_LABELS: Record<PromptConfig["type"], string> = {
  market_brief: "Market Brief",
  radar: "Opportunity Radar",
  ad_insight: "Ad Insights",
  risk: "Risk Sentinel",
  global: "Global",
};

export default function LexyBrainPromptsPage(): JSX.Element {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<PromptConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<PromptConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadConfigs = async () => {
    try {
      const response = await fetch("/api/admin/lexybrain/configs", {
        headers: { "x-user-role": "admin" },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `Failed to load configs (${response.status})`);
      }

      const payload = (await response.json()) as { configs: PromptConfig[] };
      setConfigs(payload.configs);
    } catch (error) {
      console.error("Failed to load configs", error);
      toast({
        title: "Failed to load configs",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfigs();
  }, []);

  const handleDeleteClick = (config: PromptConfig) => {
    setConfigToDelete(config);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!configToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/lexybrain/configs?id=${configToDelete.id}`, {
        method: "DELETE",
        headers: { "x-user-role": "admin" },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to delete config");
      }

      toast({
        title: "Config deleted",
        description: `${configToDelete.name} has been deleted.`,
        variant: "success",
      });

      setConfigs((prev) => prev.filter((c) => c.id !== configToDelete.id));
    } catch (error) {
      console.error("Failed to delete config", error);
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setConfigToDelete(null);
    }
  };

  const toggleActive = async (config: PromptConfig) => {
    const newActiveState = !config.is_active;

    try {
      const response = await fetch("/api/admin/lexybrain/configs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": "admin",
        },
        body: JSON.stringify({
          id: config.id,
          is_active: newActiveState,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to update config");
      }

      const payload = (await response.json()) as { config: PromptConfig };
      setConfigs((prev) =>
        prev.map((c) => {
          // If this is the config we're updating, use the response
          if (c.id === config.id) {
            return payload.config;
          }
          // If this is another config of the same type and it was active, deactivate it
          if (c.type === config.type && c.is_active && newActiveState) {
            return { ...c, is_active: false };
          }
          return c;
        }),
      );

      toast({
        title: "Config updated",
        description: `${config.name} is now ${newActiveState ? "active" : "inactive"}.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to toggle active state", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Group configs by type
  const configsByType = configs.reduce(
    (acc, config) => {
      if (!acc[config.type]) {
        acc[config.type] = [];
      }
      acc[config.type].push(config);
      return acc;
    },
    {} as Record<PromptConfig["type"], PromptConfig[]>,
  );

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Brain className="h-6 w-6 text-muted-foreground" />
              <div className="space-y-1">
                <CardTitle className="text-3xl font-bold">LexyBrain Prompts</CardTitle>
                <CardDescription className="text-base">
                  Manage prompt configurations for Market Brief, Opportunity Radar, Ad Insights, and Risk Sentinel
                </CardDescription>
              </div>
            </div>
            <Button variant="default" asChild>
              <Link href="/admin/backoffice/lexybrain/new">
                <Plus className="mr-2 h-4 w-4" />
                New Prompt Config
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Loading configurations...</p>
          </CardContent>
        </Card>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No prompt configurations found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(Object.keys(TYPE_LABELS) as PromptConfig["type"][]).map((type) => {
            const typeConfigs = configsByType[type] || [];
            if (typeConfigs.length === 0) return null;

            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle>{TYPE_LABELS[type]}</CardTitle>
                  <CardDescription>{typeConfigs.length} configuration(s)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Instructions Preview</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typeConfigs.map((config) => (
                        <TableRow key={config.id}>
                          <TableCell className="font-medium">{config.name}</TableCell>
                          <TableCell>
                            <Badge
                              variant={config.is_active ? "default" : "secondary"}
                              className="cursor-pointer"
                              onClick={() => toggleActive(config)}
                            >
                              {config.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <p className="text-sm text-muted-foreground truncate">
                              {config.system_instructions.substring(0, 100)}
                              {config.system_instructions.length > 100 ? "..." : ""}
                            </p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(config.updated_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/admin/backoffice/lexybrain/${config.id}`}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteClick(config)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete prompt configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{configToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
