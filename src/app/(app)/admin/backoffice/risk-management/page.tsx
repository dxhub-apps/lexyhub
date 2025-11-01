"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import type { RiskAppetite, RiskControl, RiskRegisterEntry } from "@/lib/risk/service";

const defaultHeaders = { "Content-Type": "application/json", "x-user-role": "admin" };

type FormState<T> = Partial<T> & { id?: string };

type ViewState = {
  appetites: RiskAppetite[];
  controls: RiskControl[];
  register: RiskRegisterEntry[];
};

const initialViewState: ViewState = { appetites: [], controls: [], register: [] };

type PillVariant = "neutral" | "info" | "success" | "warning" | "danger";

const normalise = (value?: string | null) => value?.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "_") ?? "";

const toVariant = (value: string | null | undefined, mapping: Record<string, PillVariant>): PillVariant => {
  const key = normalise(value);
  return mapping[key] ?? "neutral";
};

const humanize = (value?: string | null) =>
  value
    ?.toString()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase()) ?? "";

const appetiteVariant = (value?: string | null): PillVariant =>
  toVariant(value, {
    balanced: "info",
    conservative: "warning",
    constrained: "warning",
    restrictive: "warning",
    aggressive: "danger",
    expansive: "info",
    open: "success",
    elevated: "danger",
    low: "success",
    medium: "warning",
    high: "danger",
  });

const severityVariant = (value?: string | null): PillVariant =>
  toVariant(value, {
    critical: "danger",
    severe: "danger",
    high: "danger",
    medium: "warning",
    moderate: "warning",
    elevated: "warning",
    low: "success",
    minor: "success",
  });

const statusVariant = (value?: string | null): PillVariant =>
  toVariant(value, {
    open: "danger",
    investigating: "warning",
    in_progress: "warning",
    monitoring: "info",
    mitigated: "success",
    resolved: "success",
    closed: "neutral",
    accepted: "info",
    draft: "neutral",
  });

export default function RiskManagementPage(): JSX.Element {
  const [data, setData] = useState<ViewState>(initialViewState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appetiteForm, setAppetiteForm] = useState<FormState<RiskAppetite>>({});
  const [controlForm, setControlForm] = useState<FormState<RiskControl>>({});
  const [riskForm, setRiskForm] = useState<FormState<RiskRegisterEntry>>({ status: "open", severity: "medium" });

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
    setRiskForm({ status: "open", severity: "medium" });
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
    () => data.appetites.map((item) => ({ value: item.id, label: item.label })),
    [data.appetites],
  );
  const controlOptions = useMemo(
    () => data.controls.map((item) => ({ value: item.id, label: item.name })),
    [data.controls],
  );

  const openRisks = useMemo(
    () => data.register.filter((item) => normalise(item.status) !== "closed" && normalise(item.status) !== "mitigated").length,
    [data.register],
  );

  const summaryCards = useMemo(
    () => [
      {
        label: "Appetite bands",
        value: data.appetites.length,
        caption: "Guardrails for exposure and ownership",
      },
      {
        label: "Controls",
        value: data.controls.length,
        caption: "Mitigations in place across the program",
      },
      {
        label: "Open risks",
        value: openRisks,
        caption: `${data.register.length} tracked in the register`,
      },
    ],
    [data.appetites.length, data.controls.length, data.register.length, openRisks],
  );

  const severitySuggestions = ["Critical", "High", "Medium", "Low", "Minor"];
  const likelihoodSuggestions = ["Rare", "Unlikely", "Possible", "Likely", "Almost certain"];
  const statusSuggestions = ["Open", "Investigating", "In progress", "Monitoring", "Mitigated", "Resolved", "Closed"];

  return (
    <div className="risk-management">
      <header className="risk-management__header">
        <div>
          <h1>Risk management</h1>
          <p className="subtitle">Define appetite, controls, and track raised risks in one workspace.</p>
        </div>
        <div className="risk-management__summary">
          {summaryCards.map((card) => (
            <div key={card.label} className="risk-summary-card">
              <span className="risk-summary-card__label">{card.label}</span>
              <span className="risk-summary-card__value">{card.value}</span>
              <span className="risk-summary-card__caption">{card.caption}</span>
            </div>
          ))}
        </div>
      </header>

      {loading ? <div className="risk-alert risk-alert--info">Refreshing data…</div> : null}
      {error ? <div className="risk-alert risk-alert--error">{error}</div> : null}

      <div className="risk-management__grid">
        <section className="risk-panel">
          <div className="risk-panel__header">
            <div>
              <h2>Risk appetite</h2>
              <p className="risk-panel__description">
                Document the guardrails that define how much risk is acceptable per category and who owns the decision.
              </p>
            </div>
            {appetiteForm.id ? <span className="risk-pill risk-pill--info">Editing existing appetite</span> : null}
          </div>
          <form className="form-grid" onSubmit={onSubmitAppetite}>
            <label>
              Label
              <input
                required
                placeholder="e.g. Payments exposure"
                value={appetiteForm.label ?? ""}
                onChange={(event) => setAppetiteForm((prev) => ({ ...prev, label: event.target.value }))}
              />
            </label>
            <label>
              Category
              <input
                placeholder="Risk domain"
                value={appetiteForm.category ?? ""}
                onChange={(event) => setAppetiteForm((prev) => ({ ...prev, category: event.target.value }))}
              />
            </label>
            <label>
              Owner
              <input
                placeholder="Accountable lead"
                value={appetiteForm.owner ?? ""}
                onChange={(event) => setAppetiteForm((prev) => ({ ...prev, owner: event.target.value }))}
              />
            </label>
            <label>
              Appetite level
              <input
                placeholder="e.g. Balanced"
                value={appetiteForm.appetite_level ?? "balanced"}
                onChange={(event) => setAppetiteForm((prev) => ({ ...prev, appetite_level: event.target.value }))}
              />
            </label>
            <label className="form-grid--full">
              Notes
              <textarea
                rows={3}
                placeholder="Context to share with stakeholders"
                value={appetiteForm.notes ?? ""}
                onChange={(event) => setAppetiteForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
            <div className="form-actions">
              <button type="submit">{appetiteForm.id ? "Update" : "Create"} appetite</button>
              {appetiteForm.id ? (
                <button className="button-secondary" type="button" onClick={() => setAppetiteForm({})}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="risk-panel">
          <div className="risk-panel__header">
            <div>
              <h2>Appetite catalogue</h2>
              <p className="risk-panel__description">Stay aligned on tolerance bands and responsibility per scope.</p>
            </div>
          </div>
          <div className="risk-collection">
            {data.appetites.map((appetite) => (
              <article
                key={appetite.id}
                className={`risk-card${appetiteForm.id === appetite.id ? " risk-card--active" : ""}`}
              >
                <header className="risk-card__header">
                  <div>
                    <h3>{appetite.label}</h3>
                    {appetite.category ? <span className="risk-chip">{appetite.category}</span> : null}
                  </div>
                  {appetite.appetite_level ? (
                    <span className={`risk-pill risk-pill--${appetiteVariant(appetite.appetite_level)}`}>
                      {humanize(appetite.appetite_level)}
                    </span>
                  ) : null}
                </header>
                <div className="risk-card__meta">
                  {appetite.owner ? <span>Owner: {appetite.owner}</span> : null}
                  {appetite.notes ? <span>Notes captured</span> : null}
                </div>
                {appetite.notes ? <p className="risk-card__notes">{appetite.notes}</p> : null}
                <div className="risk-card__actions">
                  <button className="risk-card__button" type="button" onClick={() => setAppetiteForm(appetite)}>
                    Edit
                  </button>
                  <button
                    className="risk-card__button risk-card__button--danger"
                    type="button"
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
                  </button>
                </div>
              </article>
            ))}
            {data.appetites.length === 0 ? <p className="risk-empty">No appetites defined yet.</p> : null}
          </div>
        </section>

        <section className="risk-panel">
          <div className="risk-panel__header">
            <div>
              <h2>Controls</h2>
              <p className="risk-panel__description">
                Track mitigations currently deployed so you can evidence coverage and identify gaps fast.
              </p>
            </div>
            {controlForm.id ? <span className="risk-pill risk-pill--info">Editing existing control</span> : null}
          </div>
          <form className="form-grid" onSubmit={onSubmitControl}>
            <label>
              Control name
              <input
                required
                placeholder="e.g. Payment monitoring"
                value={controlForm.name ?? ""}
                onChange={(event) => setControlForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label>
              Owner
              <input
                placeholder="Control steward"
                value={controlForm.owner ?? ""}
                onChange={(event) => setControlForm((prev) => ({ ...prev, owner: event.target.value }))}
              />
            </label>
            <label>
              Status
              <input
                placeholder="e.g. Draft"
                value={controlForm.status ?? "draft"}
                onChange={(event) => setControlForm((prev) => ({ ...prev, status: event.target.value }))}
              />
            </label>
            <label>
              Coverage area
              <input
                placeholder="Scope or system"
                value={controlForm.coverage_area ?? ""}
                onChange={(event) => setControlForm((prev) => ({ ...prev, coverage_area: event.target.value }))}
              />
            </label>
            <label className="form-grid--full">
              Description
              <textarea
                rows={3}
                placeholder="Explain how the control reduces exposure"
                value={controlForm.description ?? ""}
                onChange={(event) => setControlForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
            <div className="form-actions">
              <button type="submit">{controlForm.id ? "Update" : "Create"} control</button>
              {controlForm.id ? (
                <button className="button-secondary" type="button" onClick={() => setControlForm({})}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="risk-panel">
          <div className="risk-panel__header">
            <div>
              <h2>Control library</h2>
              <p className="risk-panel__description">Review ownership, rollout status, and coverage areas.</p>
            </div>
          </div>
          <div className="risk-collection">
            {data.controls.map((control) => (
              <article
                key={control.id}
                className={`risk-card${controlForm.id === control.id ? " risk-card--active" : ""}`}
              >
                <header className="risk-card__header">
                  <div>
                    <h3>{control.name}</h3>
                    {control.coverage_area ? <span className="risk-chip">{control.coverage_area}</span> : null}
                  </div>
                  {control.status ? (
                    <span className={`risk-pill risk-pill--${statusVariant(control.status)}`}>
                      {humanize(control.status)}
                    </span>
                  ) : null}
                </header>
                <div className="risk-card__meta">
                  {control.owner ? <span>Owner: {control.owner}</span> : null}
                  {control.description ? <span>Description captured</span> : null}
                </div>
                {control.description ? <p className="risk-card__notes">{control.description}</p> : null}
                <div className="risk-card__actions">
                  <button className="risk-card__button" type="button" onClick={() => setControlForm(control)}>
                    Edit
                  </button>
                  <button
                    className="risk-card__button risk-card__button--danger"
                    type="button"
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
                  </button>
                </div>
              </article>
            ))}
            {data.controls.length === 0 ? <p className="risk-empty">No controls captured yet.</p> : null}
          </div>
        </section>

        <section className="risk-panel risk-panel--wide">
          <div className="risk-panel__header">
            <div>
              <h2>Risk register</h2>
              <p className="risk-panel__description">
                Capture new risks, link the appetite they align to, and monitor mitigation progress in one place.
              </p>
            </div>
            {riskForm.id ? <span className="risk-pill risk-pill--info">Editing existing record</span> : null}
          </div>
          <div className="risk-panel__split">
            <form className="form-grid" onSubmit={onSubmitRisk}>
              <label>
                Title
                <input
                  required
                  placeholder="Describe the risk succinctly"
                  value={riskForm.title ?? ""}
                  onChange={(event) => setRiskForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label>
                Appetite alignment
                <select
                  value={riskForm.appetite_id ?? ""}
                  onChange={(event) => setRiskForm((prev) => ({ ...prev, appetite_id: event.target.value || undefined }))}
                >
                  <option value="">Unassigned</option>
                  {appetiteOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Linked control
                <select
                  value={riskForm.control_id ?? ""}
                  onChange={(event) => setRiskForm((prev) => ({ ...prev, control_id: event.target.value || undefined }))}
                >
                  <option value="">Optional</option>
                  {controlOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Owner
                <input
                  placeholder="Risk owner"
                  value={riskForm.owner ?? ""}
                  onChange={(event) => setRiskForm((prev) => ({ ...prev, owner: event.target.value }))}
                />
              </label>
              <label>
                Status
                <input
                  list="risk-status-options"
                  placeholder="e.g. Open"
                  value={riskForm.status ?? ""}
                  onChange={(event) => setRiskForm((prev) => ({ ...prev, status: event.target.value }))}
                />
              </label>
              <label>
                Severity
                <input
                  list="risk-severity-options"
                  placeholder="e.g. Medium"
                  value={riskForm.severity ?? "medium"}
                  onChange={(event) => setRiskForm((prev) => ({ ...prev, severity: event.target.value }))}
                />
              </label>
              <label>
                Likelihood
                <input
                  list="risk-likelihood-options"
                  placeholder="e.g. Possible"
                  value={riskForm.likelihood ?? "possible"}
                  onChange={(event) => setRiskForm((prev) => ({ ...prev, likelihood: event.target.value }))}
                />
              </label>
              <label className="form-grid--full">
                Summary
                <textarea
                  rows={3}
                  placeholder="What is the impact if this risk materialises?"
                  value={riskForm.summary ?? ""}
                  onChange={(event) => setRiskForm((prev) => ({ ...prev, summary: event.target.value }))}
                />
              </label>
              <label className="form-grid--full">
                Mitigation plan
                <textarea
                  rows={3}
                  placeholder="Document current and planned mitigations"
                  value={riskForm.mitigation ?? ""}
                  onChange={(event) => setRiskForm((prev) => ({ ...prev, mitigation: event.target.value }))}
                />
              </label>
              <label className="form-grid--full">
                Follow up actions
                <textarea
                  rows={3}
                  placeholder="Track required follow ups or review cadence"
                  value={riskForm.follow_up ?? ""}
                  onChange={(event) => setRiskForm((prev) => ({ ...prev, follow_up: event.target.value }))}
                />
              </label>
              <div className="form-actions">
                <button type="submit">{riskForm.id ? "Update" : "Raise"} risk</button>
                {riskForm.id ? (
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => setRiskForm({ status: "open", severity: "medium" })}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
              <datalist id="risk-severity-options">
                {severitySuggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <datalist id="risk-likelihood-options">
                {likelihoodSuggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </form>
            <div className="risk-collection risk-collection--stacked">
              {data.register.map((entry) => (
                <article
                  key={entry.id}
                  className={`risk-card risk-card--register${riskForm.id === entry.id ? " risk-card--active" : ""}`}
                >
                  <header className="risk-card__header">
                    <div>
                      <h3>{entry.title}</h3>
                      <div className="risk-card__tags">
                        {entry.owner ? <span className="risk-chip">{entry.owner}</span> : null}
                        {entry.likelihood ? <span className="risk-chip">Likelihood: {humanize(entry.likelihood)}</span> : null}
                      </div>
                    </div>
                    <div className="risk-card__status-group">
                      {entry.status ? (
                        <span className={`risk-pill risk-pill--${statusVariant(entry.status)}`}>
                          {humanize(entry.status)}
                        </span>
                      ) : null}
                      {entry.severity ? (
                        <span className={`risk-pill risk-pill--${severityVariant(entry.severity)}`}>
                          {humanize(entry.severity)}
                        </span>
                      ) : null}
                    </div>
                  </header>
                  <div className="risk-card__meta">
                    {entry.appetite_id ? (
                      <span>
                        Appetite: {data.appetites.find((item) => item.id === entry.appetite_id)?.label ?? "Unknown"}
                      </span>
                    ) : (
                      <span>Appetite: Unassigned</span>
                    )}
                    {entry.control_id ? (
                      <span>
                        Control: {data.controls.find((item) => item.id === entry.control_id)?.name ?? "Unknown"}
                      </span>
                    ) : (
                      <span>Control: Not linked</span>
                    )}
                  </div>
                  <div className="risk-card__content">
                    <p>{entry.summary ?? "No summary provided."}</p>
                    {entry.mitigation ? (
                      <div>
                        <h4>Mitigation</h4>
                        <p>{entry.mitigation}</p>
                      </div>
                    ) : null}
                    {entry.follow_up ? (
                      <div>
                        <h4>Follow up</h4>
                        <p>{entry.follow_up}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="risk-card__actions">
                    <button className="risk-card__button" type="button" onClick={() => setRiskForm(entry)}>
                      Edit
                    </button>
                    <button
                      className="risk-card__button risk-card__button--danger"
                      type="button"
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
                    </button>
                  </div>
                </article>
              ))}
              {data.register.length === 0 ? <p className="risk-empty">No risks raised yet.</p> : null}
            </div>
          </div>
          <datalist id="risk-status-options">
            {statusSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </section>
      </div>
    </div>
  );
}
