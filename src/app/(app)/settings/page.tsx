export default function SettingsPage() {
  return (
    <div className="settings-page">
      <section className="surface-card form-card">
        <h1>Environment settings</h1>
        <p className="insights-muted">
          Manage provider credentials, integration secrets, and readiness tasks for your production workspace.
        </p>
        <div className="form-grid">
          <label>
            Supabase URL
            <input type="url" placeholder="https://project.supabase.co" autoComplete="off" />
          </label>
          <label>
            Supabase service role key
            <input type="password" placeholder="••••••••••" autoComplete="off" />
          </label>
          <label>
            Analytics webhook URL
            <input type="url" placeholder="https://hooks.lexyhub.ai/ingest" />
          </label>
          <label>
            Alert email
            <input type="email" placeholder="ops@lexyhub.ai" />
          </label>
        </div>
        <div className="form-actions">
          <button type="button">Save changes</button>
          <button type="button">Reset credentials</button>
        </div>
      </section>

      <section className="surface-card form-card">
        <h2>Docs quick links</h2>
        <ul>
          <li>
            <a
              href="https://github.com/lexyhub/lexyhub/blob/main/docs/implementation-roadmap.md"
              target="_blank"
              rel="noreferrer"
            >
              Implementation roadmap
            </a>
          </li>
          <li>
            <a href="https://supabase.com/docs" target="_blank" rel="noreferrer">
              Supabase docs
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
