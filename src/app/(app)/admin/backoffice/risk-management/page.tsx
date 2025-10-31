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

  const appetiteOptions = useMemo(() => data.appetites.map((item) => ({ value: item.id, label: item.label })), [data.appetites]);
  const controlOptions = useMemo(() => data.controls.map((item) => ({ value: item.id, label: item.name })), [data.controls]);

  return (
    <div className="risk-management">
      <header>
        <h1>Risk management</h1>
        <p className="subtitle">Define appetite, controls, and track raised risks in one workspace.</p>
      </header>
      {loading ? <p>Loading data…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="card">
        <h2>Risk appetite</h2>
        <form className="form-grid" onSubmit={onSubmitAppetite}>
          <input
            required
            placeholder="Label"
            value={appetiteForm.label ?? ""}
            onChange={(event) => setAppetiteForm((prev) => ({ ...prev, label: event.target.value }))}
          />
          <input
            placeholder="Category"
            value={appetiteForm.category ?? ""}
            onChange={(event) => setAppetiteForm((prev) => ({ ...prev, category: event.target.value }))}
          />
          <input
            placeholder="Owner"
            value={appetiteForm.owner ?? ""}
            onChange={(event) => setAppetiteForm((prev) => ({ ...prev, owner: event.target.value }))}
          />
          <input
            placeholder="Appetite level"
            value={appetiteForm.appetite_level ?? "balanced"}
            onChange={(event) => setAppetiteForm((prev) => ({ ...prev, appetite_level: event.target.value }))}
          />
          <textarea
            placeholder="Notes"
            value={appetiteForm.notes ?? ""}
            onChange={(event) => setAppetiteForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
          <div className="form-actions">
            <button type="submit">{appetiteForm.id ? "Update" : "Create"} appetite</button>
            {appetiteForm.id ? (
              <button type="button" onClick={() => setAppetiteForm({})}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        <ul className="list">
          {data.appetites.map((appetite) => (
            <li key={appetite.id}>
              <div>
                <strong>{appetite.label}</strong>
                <span className="tag">{appetite.appetite_level}</span>
                {appetite.category ? <span className="muted">{appetite.category}</span> : null}
              </div>
              <div className="list-actions">
                <button type="button" onClick={() => setAppetiteForm(appetite)}>Edit</button>
                <button
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
            </li>
          ))}
          {data.appetites.length === 0 ? <li>No appetites defined.</li> : null}
        </ul>
      </section>

      <section className="card">
        <h2>Controls</h2>
        <form className="form-grid" onSubmit={onSubmitControl}>
          <input
            required
            placeholder="Control name"
            value={controlForm.name ?? ""}
            onChange={(event) => setControlForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            placeholder="Owner"
            value={controlForm.owner ?? ""}
            onChange={(event) => setControlForm((prev) => ({ ...prev, owner: event.target.value }))}
          />
          <input
            placeholder="Status"
            value={controlForm.status ?? "draft"}
            onChange={(event) => setControlForm((prev) => ({ ...prev, status: event.target.value }))}
          />
          <input
            placeholder="Coverage area"
            value={controlForm.coverage_area ?? ""}
            onChange={(event) => setControlForm((prev) => ({ ...prev, coverage_area: event.target.value }))}
          />
          <textarea
            placeholder="Description"
            value={controlForm.description ?? ""}
            onChange={(event) => setControlForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <div className="form-actions">
            <button type="submit">{controlForm.id ? "Update" : "Create"} control</button>
            {controlForm.id ? (
              <button type="button" onClick={() => setControlForm({})}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        <ul className="list">
          {data.controls.map((control) => (
            <li key={control.id}>
              <div>
                <strong>{control.name}</strong>
                {control.status ? <span className="tag">{control.status}</span> : null}
                {control.coverage_area ? <span className="muted">{control.coverage_area}</span> : null}
              </div>
              <div className="list-actions">
                <button type="button" onClick={() => setControlForm(control)}>Edit</button>
                <button
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
            </li>
          ))}
          {data.controls.length === 0 ? <li>No controls captured.</li> : null}
        </ul>
      </section>

      <section className="card">
        <h2>Risk register</h2>
        <form className="form-grid" onSubmit={onSubmitRisk}>
          <input
            required
            placeholder="Risk title"
            value={riskForm.title ?? ""}
            onChange={(event) => setRiskForm((prev) => ({ ...prev, title: event.target.value }))}
          />
          <select
            value={riskForm.appetite_id ?? ""}
            onChange={(event) => setRiskForm((prev) => ({ ...prev, appetite_id: event.target.value || undefined }))}
          >
            <option value="">Appetite</option>
            {appetiteOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={riskForm.control_id ?? ""}
            onChange={(event) => setRiskForm((prev) => ({ ...prev, control_id: event.target.value || undefined }))}
          >
            <option value="">Control</option>
            {controlOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            placeholder="Owner"
            value={riskForm.owner ?? ""}
            onChange={(event) => setRiskForm((prev) => ({ ...prev, owner: event.target.value }))}
          />
          <input
            placeholder="Severity"
            value={riskForm.severity ?? "medium"}
            onChange={(event) => setRiskForm((prev) => ({ ...prev, severity: event.target.value }))}
          />
          <input
            placeholder="Likelihood"
            value={riskForm.likelihood ?? "possible"}
            onChange={(event) => setRiskForm((prev) => ({ ...prev, likelihood: event.target.value }))}
          />
          <textarea
            placeholder="Summary"
            value={riskForm.summary ?? ""}
            onChange={(event) => setRiskForm((prev) => ({ ...prev, summary: event.target.value }))}
          />
          <textarea
            placeholder="Mitigation"
            value={riskForm.mitigation ?? ""}
            onChange={(event) => setRiskForm((prev) => ({ ...prev, mitigation: event.target.value }))}
          />
          <textarea
            placeholder="Follow up"
            value={riskForm.follow_up ?? ""}
            onChange={(event) => setRiskForm((prev) => ({ ...prev, follow_up: event.target.value }))}
          />
          <div className="form-actions">
            <button type="submit">{riskForm.id ? "Update" : "Raise"} risk</button>
            {riskForm.id ? (
              <button type="button" onClick={() => setRiskForm({ status: "open", severity: "medium" })}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        <ul className="list">
          {data.register.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>{entry.title}</strong>
                <span className="tag">{entry.status}</span>
                <span className="muted">Severity: {entry.severity}</span>
              </div>
              <p className="muted">{entry.summary ?? "No summary"}</p>
              <div className="list-actions">
                <button type="button" onClick={() => setRiskForm(entry)}>Edit</button>
                <button
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
            </li>
          ))}
          {data.register.length === 0 ? <li>No risks raised.</li> : null}
        </ul>
      </section>
    </div>
  );
}
