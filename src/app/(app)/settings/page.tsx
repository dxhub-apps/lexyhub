export default function SettingsPage() {
  return (
    <div style={{ display: "grid", gap: "1.25rem", maxWidth: "640px" }}>
      <header>
        <h1 style={{ margin: 0 }}>Environment Settings</h1>
        <p style={{ color: "#cbd5f5" }}>
          Track secrets, provider keys, and operational readiness as we scale future sprints.
        </p>
      </header>
      <section style={{ background: "rgba(15,23,42,0.65)", padding: "1.5rem", borderRadius: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Docs quick links</h2>
        <ul style={{ margin: 0, paddingLeft: "1.5rem", color: "#cbd5f5" }}>
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
