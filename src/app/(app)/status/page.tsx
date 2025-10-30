import { generateStatusReport, type StatusLevel } from "@/lib/status";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: StatusLevel }) {
  return <span className={`status-badge status-badge--${status}`}>{status}</span>;
}

function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!hours && !minutes) parts.push(`${remaining}s`);

  return parts.join(" ");
}

export default async function StatusPage() {
  const status = await generateStatusReport();

  return (
    <div className="status-page">
      <header className="status-header">
        <div>
          <h1>Platform Status</h1>
          <p>
            Real-time visibility into LexyHub configuration, critical services, and API
            availability.
          </p>
        </div>
        <div className="status-summary">
          <div>
            <span>Last Updated</span>
            <strong>{new Date(status.generatedAt).toLocaleString()}</strong>
          </div>
          <div>
            <span>Environment</span>
            <strong>{status.environment}</strong>
          </div>
        </div>
      </header>

      <section className="status-section">
        <h2>Runtime</h2>
        <div className="status-grid">
          <article className="status-card">
            <span>Node.js</span>
            <strong>{status.runtime.node}</strong>
          </article>
          <article className="status-card">
            <span>Platform</span>
            <strong>
              {status.runtime.platform} {status.runtime.release}
            </strong>
          </article>
          <article className="status-card">
            <span>Process Uptime</span>
            <strong>{formatSeconds(status.runtime.uptimeSeconds)}</strong>
          </article>
          {status.runtime.region ? (
            <article className="status-card">
              <span>Region</span>
              <strong>{status.runtime.region}</strong>
            </article>
          ) : null}
        </div>
      </section>

      <section className="status-section">
        <h2>Environment Variables</h2>
        <table className="status-table">
          <thead>
            <tr>
              <th scope="col">Variable</th>
              <th scope="col">Status</th>
              <th scope="col">Preview</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {status.variables.map((variable) => (
              <tr key={variable.key}>
                <td>
                  <strong>{variable.key}</strong>
                  <div className="status-subtle">{variable.label}</div>
                </td>
                <td>
                  <StatusBadge status={variable.status} />
                </td>
                <td>{variable.preview}</td>
                <td>{variable.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="status-section">
        <h2>API Surface</h2>
        <div className="status-panels">
          {status.apis.map((api) => (
            <article key={api.id} className="status-panel">
              <header>
                <div>
                  <h3>{api.name}</h3>
                  <StatusBadge status={api.status} />
                </div>
              </header>
              <p>{api.message}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="status-section">
        <h2>Service Integrations</h2>
        <div className="status-panels">
          {status.services.map((service) => (
            <article key={service.id} className="status-panel">
              <header>
                <div>
                  <h3>{service.name}</h3>
                  <StatusBadge status={service.status} />
                </div>
              </header>
              <p>{service.message}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
