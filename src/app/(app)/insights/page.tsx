"use client";

import { useCallback, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import IntentGraph from "@/components/insights/IntentGraph";
import TrendRadar from "@/components/insights/TrendRadar";
import { useToast } from "@/components/ui/ToastProvider";

type VisualTagResponse = {
  caption: string;
  tags: Array<{ tag: string; confidence: number }>;
  assetPath?: string;
};

export default function InsightsPage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hints, setHints] = useState("handmade, ceramic");
  const [result, setResult] = useState<VisualTagResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const { push } = useToast();

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!imagePreview) {
        push({
          title: "Upload required",
          description: "Select an asset before running Visual Tag AI.",
          tone: "warning",
        });
        return;
      }

      setUploading(true);
      setResult(null);
      try {
        const response = await fetch("/api/ai/visual-tag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: imagePreview,
            keywordHints: hints
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean),
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Visual tag request failed (${response.status})`);
        }

        const payload = (await response.json()) as VisualTagResponse;
        setResult(payload);
        push({
          title: "Visual tags ready",
          description: "AI extracted marketplace-ready tags with caption context.",
          tone: "success",
        });
      } catch (error) {
        console.error("Visual tag AI failed", error);
        push({
          title: "Visual tag AI error",
          description: error instanceof Error ? error.message : "Unexpected error",
          tone: "error",
        });
      } finally {
        setUploading(false);
      }
    },
    [hints, imagePreview, push],
  );

  return (
    <Stack spacing={3}>
      <Card>
        <CardHeader
          title="Commerce Insights"
          subheader="Explore real-time trend radar views, purchase intent graphs, and partner analytics to uncover the next products to launch."
        />
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} xl={6}>
          <TrendRadar />
        </Grid>
        <Grid item xs={12} xl={6}>
          <IntentGraph />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Visual Tag AI" subheader="Upload an asset to generate caption and tag suggestions." />
            <CardContent>
              <Stack component="form" spacing={2} onSubmit={handleSubmit}>
                <Button variant="outlined" component="label">
                  Select listing asset
                  <input type="file" accept="image/*" hidden onChange={handleFileChange} />
                </Button>
                {imagePreview ? (
                  <Box
                    component="img"
                    src={imagePreview}
                    alt="Preview"
                    sx={{ width: "100%", borderRadius: 2, border: (theme) => `1px solid ${theme.palette.divider}` }}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 160,
                      borderRadius: 2,
                      border: (theme) => `1px dashed ${theme.palette.divider}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "text.secondary",
                    }}
                  >
                    Upload an image to preview
                  </Box>
                )}
                <TextField
                  label="Keyword hints"
                  value={hints}
                  onChange={(event) => setHints(event.target.value)}
                  placeholder="e.g. handmade, ceramic, planter"
                  fullWidth
                />
                <Button type="submit" variant="contained" disabled={uploading}>
                  {uploading ? "Generating…" : "Generate Tags"}
                </Button>
              </Stack>
              {result ? (
                <Stack spacing={2} sx={{ mt: 3 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Caption
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {result.caption}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Tags
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                      {result.tags.map((tag) => (
                        <Chip key={tag.tag} label={`${tag.tag} · ${Math.round(tag.confidence * 100)}%`} variant="outlined" />
                      ))}
                    </Stack>
                  </Box>
                  {result.assetPath ? (
                    <Typography variant="caption" color="text.secondary">
                      Stored at: {result.assetPath}
                    </Typography>
                  ) : null}
                </Stack>
              ) : null}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Watchlist momentum" />
            <CardContent>
              <Stack spacing={1.5} component="ul" sx={{ pl: 2 }}>
                <Typography component="li" variant="body2">
                  Trend radar metrics sync with keyword momentum to highlight the strongest opportunities.
                </Typography>
                <Typography component="li" variant="body2">
                  Intent classification automatically populates downstream personalization signals.
                </Typography>
                <Typography component="li" variant="body2">
                  The partner API exposes normalized keywords with managed, rate-limited access keys.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
