import { generateStatusReport, type StatusLevel } from "@/lib/status";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<StatusLevel, string> = {
  operational: "Operational",
  warning: "Warning",
  critical: "Critical",
};

function StatusBadge({ status }: { status: StatusLevel }) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      <span className={`status-badge__dot status-badge__dot--${status}`} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

function getOverallStatus(report: Awaited<ReturnType<typeof generateStatusReport>>): StatusLevel {
  const priority: Record<StatusLevel, number> = {
    operational: 0,
    warning: 1,
    critical: 2,
  };

  const checks = [...report.apis, ...report.services, ...report.workers];

  return checks.reduce<StatusLevel>((current, { status }) => {
    return priority[status] > priority[current] ? status : current;
  }, "operational");
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
  const overallStatus = getOverallStatus(status);
  const generatedAt = new Date(status.generatedAt);

  return (
    <div className="status-page">
      <section className="surface-card status-header">
        <div className="status-header__copy">
          <span className="status-eyebrow">LexyHub</span>
          <h1>Platform health</h1>
          <p>
            A compact snapshot of runtime diagnostics, first-party APIs, and service integrations
            monitored from the server.
          </p>
        </div>
        <dl className="status-meta">
          <div className="status-meta__item">
            <dt>Overall</dt>
            <dd>
              <StatusBadge status={overallStatus} />
            </dd>
          </div>
          <div className="status-meta__item">
            <dt>Last updated</dt>
            <dd>
              <time dateTime={status.generatedAt}>{generatedAt.toLocaleString()}</time>
            </dd>
          </div>
          <div className="status-meta__item">
            <dt>Environment</dt>
            <dd>{status.environment}</dd>
          </div>
        </dl>
      </section>

      <section className="status-section">
        <div className="status-section__header">
          <h2>Runtime snapshot</h2>
          <p>Key diagnostics from the current deployment.</p>
        </div>
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
        <div className="status-section__header">
          <h2>API surface</h2>
          <p>Availability of the shipped API handlers.</p>
        </div>
        <div className="status-list">
          {status.apis.map((api) => (
            <article key={api.id} className="status-item">
              <header>
                <h3>{api.name}</h3>
                <StatusBadge status={api.status} />
              </header>
              <p>{api.message}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="status-section">
        <div className="status-section__header">
          <h2>Service integrations</h2>
          <p>External dependencies monitored from the server.</p>
        </div>
        <div className="status-list">
          {status.services.map((service) => (
            <article key={service.id} className="status-item">
              <header>
                <h3>{service.name}</h3>
                <StatusBadge status={service.status} />
              </header>
              <p>{service.message}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="status-section">
        <div className="status-section__header">
          <h2>Background workers</h2>
          <p>Automation endpoints that populate live intelligence data.</p>
        </div>
        <div className="status-list">
          {status.workers.map((worker) => (
            <article key={worker.id} className="status-item">
              <header>
                <h3>{worker.name}</h3>
                <StatusBadge status={worker.status} />
              </header>
              <p>{worker.message}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
