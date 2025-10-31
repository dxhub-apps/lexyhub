"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { RiskAppetite, RiskControl, RiskRegisterEntry } from "@/lib/risk/service";

const defaultHeaders = { "Content-Type": "application/json", "x-user-role": "admin" };

type FormState<T> = Partial<T> & { id?: string };

type ViewState = {
  appetites: RiskAppetite[];
  controls: RiskControl[];
  register: RiskRegisterEntry[];
};

const initialViewState: ViewState = { appetites: [], controls: [], register: [] };

const defaultRiskForm: FormState<RiskRegisterEntry> = { status: "open", severity: "medium" };

export default function RiskManagementPage(): JSX.Element {
  const [data, setData] = useState<ViewState>(initialViewState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appetiteForm, setAppetiteForm] = useState<FormState<RiskAppetite>>({});
  const [controlForm, setControlForm] = useState<FormState<RiskControl>>({});
  const [riskForm, setRiskForm] = useState<FormState<RiskRegisterEntry>>(() => ({ ...defaultRiskForm }));

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appResp, controlResp, registerResp] = await Promise.all([
        fetch("/api/admin/risk-appetites", { headers: { "x-user-role": "admin" } }),
        fetch("/api/admin/risk-controls", { headers: { "x-user-role": "admin" } }),
        fetch("/api/admin/risk-register", { headers: { "x-user-role": "admin" } }),
      ]);

      if (!appResp.ok) {
        const payload = await appResp.json().catch(() => ({}));
        throw new Error(payload.error ?? `Risk appetite load failed (${appResp.status})`);
      }
      if (!controlResp.ok) {
        const payload = await controlResp.json().catch(() => ({}));
        throw new Error(payload.error ?? `Risk control load failed (${controlResp.status})`);
      }
      if (!registerResp.ok) {
        const payload = await registerResp.json().catch(() => ({}));
        throw new Error(payload.error ?? `Risk register load failed (${registerResp.status})`);
      }

      const appetites = ((await appResp.json()) as { appetites: RiskAppetite[] }).appetites ?? [];
      const controls = ((await controlResp.json()) as { controls: RiskControl[] }).controls ?? [];
      const register = ((await registerResp.json()) as { register: RiskRegisterEntry[] }).register ?? [];

      setData({ appetites, controls, register });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForms = () => {
    setAppetiteForm({});
    setControlForm({});
    setRiskForm({ ...defaultRiskForm });
  };

  const upsert = async (url: string, payload: Record<string, unknown>, method: "POST" | "PUT") => {
    const response = await fetch(url, {
      method,
      headers: defaultHeaders,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const message = await response.json().catch(() => ({}));
      throw new Error(message.error ?? `Request failed (${response.status})`);
    }
    return response.json();
  };

  const remove = async (url: string) => {
    const response = await fetch(url, { method: "DELETE", headers: { "x-user-role": "admin" } });
    if (!response.ok) {
      const message = await response.json().catch(() => ({}));
      throw new Error(message.error ?? `Delete failed (${response.status})`);
    }
    return response.json();
  };

  const onSubmitAppetite = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const method = appetiteForm.id ? "PUT" : "POST";
      await upsert("/api/admin/risk-appetites", appetiteForm as Record<string, unknown>, method);
      resetForms();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onSubmitControl = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const method = controlForm.id ? "PUT" : "POST";
      await upsert("/api/admin/risk-controls", controlForm as Record<string, unknown>, method);
      resetForms();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onSubmitRisk = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const method = riskForm.id ? "PUT" : "POST";
      await upsert("/api/admin/risk-register", riskForm as Record<string, unknown>, method);
      resetForms();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const appetiteOptions = useMemo(
    () =>
      data.appetites.map((item) => ({
        value: String(item.id),
        label: item.label,
      })),
    [data.appetites],
  );

  const controlOptions = useMemo(
    () =>
      data.controls.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    [data.controls],
  );

  const appetiteLookup = useMemo(() => {
    const map = new Map<string, string>();
    data.appetites.forEach((item) => {
      map.set(String(item.id), item.label);
    });
    return map;
  }, [data.appetites]);

  const controlLookup = useMemo(() => {
    const map = new Map<string, string>();
    data.controls.forEach((item) => {
      map.set(String(item.id), item.name);
    });
    return map;
  }, [data.controls]);

  const severityChipColor = (severity?: string) => {
    if (!severity) return "default" as const;
    const normalized = severity.toLowerCase();
    if (normalized === "low") return "success" as const;
    if (normalized === "medium") return "warning" as const;
    if (normalized === "high" || normalized === "critical") return "error" as const;
    return "default" as const;
  };

  return (
    <Stack spacing={3}>
      <Card>
        <CardHeader
          title="Risk management"
          subheader="Define appetite, manage controls, and maintain the operational risk register."
        />
        <CardContent>
          {loading ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={18} thickness={5} />
              <Typography variant="body2" color="text.secondary">
                Refreshing the latest telemetry…
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Use the Material Design forms below to add new appetites, instrument controls, and triage active risks with
              consistent styling across light and dark themes.
            </Typography>
          )}
        </CardContent>
      </Card>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: "100%" }}>
            <CardHeader
              title={appetiteForm.id ? "Edit risk appetite" : "Risk appetites"}
              subheader="Capture the guardrails that define acceptable risk for your operation."
            />
            <CardContent>
              <Stack spacing={3}>
                <Box component="form" onSubmit={onSubmitAppetite}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        required
                        fullWidth
                        label="Label"
                        value={appetiteForm.label ?? ""}
                        onChange={(event) =>
                          setAppetiteForm((prev) => ({ ...prev, label: event.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Category"
                        value={appetiteForm.category ?? ""}
                        onChange={(event) =>
                          setAppetiteForm((prev) => ({ ...prev, category: event.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Owner"
                        value={appetiteForm.owner ?? ""}
                        onChange={(event) =>
                          setAppetiteForm((prev) => ({ ...prev, owner: event.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Appetite level"
                        value={appetiteForm.appetite_level ?? "balanced"}
                        onChange={(event) =>
                          setAppetiteForm((prev) => ({ ...prev, appetite_level: event.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Notes"
                        value={appetiteForm.notes ?? ""}
                        onChange={(event) =>
                          setAppetiteForm((prev) => ({ ...prev, notes: event.target.value }))
                        }
                      />
                    </Grid>
                  </Grid>
                  <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2 }}>
                    {appetiteForm.id ? (
                      <Button variant="outlined" onClick={() => setAppetiteForm({})}>
                        Cancel
                      </Button>
                    ) : null}
                    <Button type="submit" variant="contained">
                      {appetiteForm.id ? "Update appetite" : "Create appetite"}
                    </Button>
                  </Stack>
                </Box>

                <Divider light />

                <Stack spacing={2}>
                  {data.appetites.map((appetite) => (
                    <Paper
                      key={appetite.id}
                      variant="outlined"
                      sx={{
                        p: 2.5,
                        display: "flex",
                        flexDirection: { xs: "column", sm: "row" },
                        gap: 2,
                        justifyContent: "space-between",
                        alignItems: { sm: "center" },
                      }}
                    >
                      <Stack spacing={0.75} sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {appetite.label}
                          </Typography>
                          <Chip
                            label={appetite.appetite_level}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {appetite.category ? (
                            <Typography variant="body2" color="text.secondary">
                              Category: {appetite.category}
                            </Typography>
                          ) : null}
                          {appetite.owner ? (
                            <Typography variant="body2" color="text.secondary">
                              Owner: {appetite.owner}
                            </Typography>
                          ) : null}
                        </Stack>
                        {appetite.notes ? (
                          <Typography variant="body2" color="text.secondary">
                            {appetite.notes}
                          </Typography>
                        ) : null}
                      </Stack>
                      <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setAppetiteForm(appetite)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          onClick={async () => {
                            try {
                              await remove(`/api/admin/risk-appetites?id=${appetite.id}`);
                              await loadData();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : String(err));
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Paper>
                  ))}
                  {data.appetites.length === 0 ? (
                    <Alert severity="info">No appetites defined yet.</Alert>
                  ) : null}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card sx={{ height: "100%" }}>
            <CardHeader
              title={controlForm.id ? "Edit control" : "Controls"}
              subheader="Document the operational levers and owners mitigating the captured risks."
            />
            <CardContent>
              <Stack spacing={3}>
                <Box component="form" onSubmit={onSubmitControl}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        required
                        fullWidth
                        label="Control name"
                        value={controlForm.name ?? ""}
                        onChange={(event) =>
                          setControlForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Owner"
                        value={controlForm.owner ?? ""}
                        onChange={(event) =>
                          setControlForm((prev) => ({ ...prev, owner: event.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Status"
                        value={controlForm.status ?? "draft"}
                        onChange={(event) =>
                          setControlForm((prev) => ({ ...prev, status: event.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Coverage area"
                        value={controlForm.coverage_area ?? ""}
                        onChange={(event) =>
                          setControlForm((prev) => ({ ...prev, coverage_area: event.target.value }))
                        }
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Description"
                        value={controlForm.description ?? ""}
                        onChange={(event) =>
                          setControlForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                      />
                    </Grid>
                  </Grid>
                  <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2 }}>
                    {controlForm.id ? (
                      <Button variant="outlined" onClick={() => setControlForm({})}>
                        Cancel
                      </Button>
                    ) : null}
                    <Button type="submit" variant="contained">
                      {controlForm.id ? "Update control" : "Create control"}
                    </Button>
                  </Stack>
                </Box>

                <Divider light />

                <Stack spacing={2}>
                  {data.controls.map((control) => (
                    <Paper
                      key={control.id}
                      variant="outlined"
                      sx={{
                        p: 2.5,
                        display: "flex",
                        flexDirection: { xs: "column", sm: "row" },
                        gap: 2,
                        justifyContent: "space-between",
                        alignItems: { sm: "center" },
                      }}
                    >
                      <Stack spacing={0.75} sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {control.name}
                          </Typography>
                          <Chip
                            label={control.status}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {control.owner ? (
                            <Typography variant="body2" color="text.secondary">
                              Owner: {control.owner}
                            </Typography>
                          ) : null}
                          {control.coverage_area ? (
                            <Typography variant="body2" color="text.secondary">
                              Coverage: {control.coverage_area}
                            </Typography>
                          ) : null}
                        </Stack>
                        {control.description ? (
                          <Typography variant="body2" color="text.secondary">
                            {control.description}
                          </Typography>
                        ) : null}
                      </Stack>
                      <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setControlForm(control)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          onClick={async () => {
                            try {
                              await remove(`/api/admin/risk-controls?id=${control.id}`);
                              await loadData();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : String(err));
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Paper>
                  ))}
                  {data.controls.length === 0 ? (
                    <Alert severity="info">No controls captured yet.</Alert>
                  ) : null}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardHeader
          title={riskForm.id ? "Edit risk" : "Risk register"}
          subheader="Track incidents, assign owners, and document mitigation strategies."
        />
        <CardContent>
          <Stack spacing={3}>
            <Box component="form" onSubmit={onSubmitRisk}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    label="Risk title"
                    value={riskForm.title ?? ""}
                    onChange={(event) =>
                      setRiskForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Linked appetite"
                    value={riskForm.appetite_id ?? ""}
                    onChange={(event) =>
                      setRiskForm((prev) => ({
                        ...prev,
                        appetite_id: event.target.value ? event.target.value : undefined,
                      }))
                    }
                  >
                    <MenuItem value="">None</MenuItem>
                    {appetiteOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Linked control"
                    value={riskForm.control_id ?? ""}
                    onChange={(event) =>
                      setRiskForm((prev) => ({
                        ...prev,
                        control_id: event.target.value ? event.target.value : undefined,
                      }))
                    }
                  >
                    <MenuItem value="">None</MenuItem>
                    {controlOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Owner"
                    value={riskForm.owner ?? ""}
                    onChange={(event) =>
                      setRiskForm((prev) => ({ ...prev, owner: event.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Status"
                    value={riskForm.status ?? "open"}
                    onChange={(event) =>
                      setRiskForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Severity"
                    value={riskForm.severity ?? "medium"}
                    onChange={(event) =>
                      setRiskForm((prev) => ({ ...prev, severity: event.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Likelihood"
                    value={riskForm.likelihood ?? "possible"}
                    onChange={(event) =>
                      setRiskForm((prev) => ({ ...prev, likelihood: event.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    label="Summary"
                    value={riskForm.summary ?? ""}
                    onChange={(event) =>
                      setRiskForm((prev) => ({ ...prev, summary: event.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    label="Mitigation"
                    value={riskForm.mitigation ?? ""}
                    onChange={(event) =>
                      setRiskForm((prev) => ({ ...prev, mitigation: event.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    label="Follow up"
                    value={riskForm.follow_up ?? ""}
                    onChange={(event) =>
                      setRiskForm((prev) => ({ ...prev, follow_up: event.target.value }))
                    }
                  />
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2 }}>
                {riskForm.id ? (
                  <Button variant="outlined" onClick={() => setRiskForm({ ...defaultRiskForm })}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" variant="contained">
                  {riskForm.id ? "Update risk" : "Raise risk"}
                </Button>
              </Stack>
            </Box>

            <Divider light />

            <Stack spacing={2}>
              {data.register.map((entry) => {
                const appetiteLabel = entry.appetite_id
                  ? appetiteLookup.get(String(entry.appetite_id))
                  : undefined;
                const controlLabel = entry.control_id
                  ? controlLookup.get(String(entry.control_id))
                  : undefined;
                return (
                  <Paper
                    key={entry.id}
                    variant="outlined"
                    sx={{
                      p: 2.5,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.5,
                    }}
                  >
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {entry.title}
                        </Typography>
                        <Chip
                          label={entry.status}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          label={`Severity: ${entry.severity}`}
                          size="small"
                          color={severityChipColor(entry.severity)}
                          variant="outlined"
                        />
                        {entry.likelihood ? (
                          <Chip
                            label={`Likelihood: ${entry.likelihood}`}
                            size="small"
                            variant="outlined"
                          />
                        ) : null}
                      </Stack>
                      {entry.summary ? (
                        <Typography variant="body2" color="text.secondary">
                          {entry.summary}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No summary provided yet.
                        </Typography>
                      )}
                      <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
                        {entry.owner ? (
                          <Typography variant="caption" color="text.secondary">
                            Owner: {entry.owner}
                          </Typography>
                        ) : null}
                        {appetiteLabel ? (
                          <Typography variant="caption" color="text.secondary">
                            Appetite: {appetiteLabel}
                          </Typography>
                        ) : null}
                        {controlLabel ? (
                          <Typography variant="caption" color="text.secondary">
                            Control: {controlLabel}
                          </Typography>
                        ) : null}
                      </Stack>
                      {entry.mitigation ? (
                        <Typography variant="body2" color="text.secondary">
                          Mitigation: {entry.mitigation}
                        </Typography>
                      ) : null}
                      {entry.follow_up ? (
                        <Typography variant="body2" color="text.secondary">
                          Follow up: {entry.follow_up}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() =>
                          setRiskForm({
                            id: entry.id,
                            title: entry.title,
                            summary: entry.summary ?? undefined,
                            status: entry.status,
                            severity: entry.severity,
                            likelihood: entry.likelihood,
                            owner: entry.owner ?? undefined,
                            appetite_id: entry.appetite_id ?? undefined,
                            control_id: entry.control_id ?? undefined,
                            mitigation: entry.mitigation ?? undefined,
                            follow_up: entry.follow_up ?? undefined,
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={async () => {
                          try {
                            await remove(`/api/admin/risk-register?id=${entry.id}`);
                            await loadData();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : String(err));
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Paper>
                );
              })}
              {data.register.length === 0 ? (
                <Alert severity="info">No risks raised yet. Use the form above to capture your first entry.</Alert>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
