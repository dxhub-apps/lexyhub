import type { Metadata } from "next";

const quickLinks = [
  {
    href: "#overview",
    label: "Overview",
    description: "Understand LexyHub's purpose and who should use it.",
  },
  {
    href: "#getting-started",
    label: "Getting started",
    description: "Set up your account, workspace, and onboarding tasks.",
  },
  {
    href: "#dashboard",
    label: "Dashboard",
    description: "Track quota pulse, momentum, and alerts.",
  },
  {
    href: "#keywords",
    label: "Keywords",
    description: "Discover and monitor high-intent terms.",
  },
  {
    href: "#market-twin",
    label: "Market Twin",
    description: "Simulate demand scenarios and compare outcomes.",
  },
  {
    href: "#support",
    label: "Help & support",
    description: "Resolve issues and contact the LexyHub team.",
  },
];

const repositoryDocsBaseUrl =
  "https://github.com/alex-perevalos-projects/lexyhub/blob/main/docs" as const;

const additionalResourceLinks = {
  environmentSetup: `${repositoryDocsBaseUrl}/environment-setup.md`,
  implementationRoadmap: `${repositoryDocsBaseUrl}/implementation-roadmap.md`,
  etsyIntegration: `${repositoryDocsBaseUrl}/etsy-integration.md`,
  trendIntentIntelligence: `${repositoryDocsBaseUrl}/trend-intent-intelligence.md`,
  statusPlaybook: `${repositoryDocsBaseUrl}/status-page.md`,
  changelog: `${repositoryDocsBaseUrl}/changelog.md`,
} as const;

export const metadata: Metadata = {
  title: "LexyHub Documentation",
  description: "Product documentation, how-tos, and troubleshooting resources for LexyHub users.",
};

export default function DocumentationPage(): JSX.Element {
  return (
    <article className="documentation">
      <header className="documentation-header">
        <div>
          <span className="documentation-eyebrow">Help center</span>
          <h1>LexyHub User Documentation</h1>
          <p>
            Explore every area of the platform, master critical workflows, and troubleshoot issues without leaving the
            app. Use the quick links below or scroll through the sections to learn how LexyHub accelerates your growth
            programs.
          </p>
        </div>
        <div className="documentation-meta">
          <dl>
            <div>
              <dt>Last updated</dt>
              <dd>May 9, 2024</dd>
            </div>
            <div>
              <dt>Audience</dt>
              <dd>Growth managers, operators, analysts, executives</dd>
            </div>
            <div>
              <dt>Support</dt>
              <dd>
                <a href="mailto:support@lexyhub.ai">support@lexyhub.ai</a>
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <nav className="documentation-quick-links" aria-label="Quick links">
        {quickLinks.map((link) => (
          <a key={link.href} href={link.href} className="documentation-quick-link">
            <span>{link.label}</span>
            <small>{link.description}</small>
          </a>
        ))}
      </nav>

      <section id="overview" className="documentation-section">
        <h2>Overview</h2>
        <p>
          LexyHub is the central workspace for monitoring sales velocity, discovering high-intent keywords, and coordinating
          market intelligence. This guide explains every surface of the product, recommended workflows, and troubleshooting
          steps so that new and existing teammates can become productive quickly.
        </p>
        <ul>
          <li>
            <strong>Audience:</strong> growth managers, marketplace operators, analysts, and executives using LexyHub to plan
            and execute marketplace strategies.
          </li>
          <li>
            <strong>Prerequisites:</strong> an active LexyHub account and access to the data sources configured by your
            organization.
          </li>
        </ul>
      </section>

      <section id="getting-started" className="documentation-section">
        <h2>Getting started</h2>
        <ol>
          <li>
            <strong>Sign in:</strong> Visit the LexyHub URL provided by your administrator and authenticate with your work
            email. The avatar menu (top right) confirms the active plan and account.
          </li>
          <li>
            <strong>Select a workspace:</strong> If your organization manages multiple storefronts, use the workspace switcher
            presented during sign in to pick the correct environment. All metrics and automations respect the chosen
            workspace.
          </li>
          <li>
            <strong>Review onboarding alerts:</strong> The notification indicator in the top bar highlights setup tasks such as
            connecting an Etsy shop or approving data scopes.
          </li>
          <li>
            <strong>Explore the app shell:</strong> The left navigation provides access to product areas, while the top bar
            shows platform status, environment labels, and the global user menu.
          </li>
        </ol>
      </section>

      <section id="layout" className="documentation-section">
        <h2>Layout reference</h2>
        <p>LexyHub uses a responsive two-pane layout composed of:</p>
        <ul>
          <li>
            <strong>Sidebar navigation:</strong> Links to Dashboard, Keywords, Insights, Market Twin, Settings, and Status.
            Collapse the sidebar by selecting the toggle in the top-left corner; the navigation automatically collapses on mobile
            breakpoints.
          </li>
          <li>
            <strong>Top bar:</strong> Displays the product name, contextual subtitle, environment (e.g., <code>development</code>,
            <code>preview</code>, <code>production</code>), a shortcut to the Status page, and the user menu.
          </li>
          <li>
            <strong>User menu:</strong> Provides profile management, theme switching, how-to documentation, and a logout control.
            The menu stays consistent across every screen.
          </li>
        </ul>
      </section>

      <section id="dashboard" className="documentation-section">
        <h2>Dashboard</h2>
        <p>The Dashboard offers a high-level snapshot of revenue pacing and target attainment.</p>
        <ul>
          <li>
            <strong>Quota pulse cards:</strong> Summaries of current sales versus quota, including leading indicators for Etsy and
            other marketplaces.
          </li>
          <li>
            <strong>Momentum charts:</strong> Visualize trailing performance windows and conversion trends. Hover a point to
            inspect underlying metrics.
          </li>
          <li>
            <strong>Alerts feed:</strong> Lists noteworthy events such as inventory risks or policy changes. Use the
            &quot;Acknowledge&quot; control to dismiss items that have been resolved.
          </li>
        </ul>
        <div className="documentation-howto">
          <h3>How to monitor revenue pacing</h3>
          <ol>
            <li>Navigate to <strong>Dashboard → Quota Pulse</strong>.</li>
            <li>Review the headline KPIs and confirm they align with the plan.</li>
            <li>Drill into the relevant chart to spot anomalies.</li>
            <li>Share findings with stakeholders using the export option in the chart toolbar.</li>
          </ol>
        </div>
      </section>

      <section id="keywords" className="documentation-section">
        <h2>Keywords</h2>
        <p>The Keywords workspace surfaces organic search opportunities discovered by LexyHub&apos;s AI.</p>
        <ul>
          <li>
            <strong>Opportunity table:</strong> Ranked list of recommended keywords, including demand score, competitive pressure,
            and suggested actions.
          </li>
          <li>
            <strong>Filters:</strong> Narrow the dataset by storefront, seasonality, or intent level.
          </li>
          <li>
            <strong>Watchlists:</strong> Pin mission-critical keywords to monitor their movement over time.
          </li>
        </ul>
        <div className="documentation-howto">
          <h3>How to build a keyword watchlist</h3>
          <ol>
            <li>Open <strong>Keywords</strong> from the sidebar.</li>
            <li>Apply filters that reflect your campaign goals.</li>
            <li>Select the desired rows and click <strong>Add to watchlist</strong>.</li>
            <li>Choose an existing watchlist or create a new one. Watchlists sync automatically with market updates.</li>
          </ol>
        </div>
      </section>

      <section id="insights" className="documentation-section">
        <h2>Insights</h2>
        <p>Insights consolidates narrative explanations, anomaly detection, and automated commentary.</p>
        <ul>
          <li>
            <strong>Insight cards:</strong> Each card outlines the context, the detected pattern, and the recommended response.
          </li>
          <li>
            <strong>Narratives panel:</strong> Provides generated summaries for stakeholder-ready reporting.
          </li>
          <li>
            <strong>Collaboration tools:</strong> Share an insight or tag a teammate for follow-up.
          </li>
        </ul>
        <div className="documentation-howto">
          <h3>How to publish an insight recap</h3>
          <ol>
            <li>Go to <strong>Insights</strong>.</li>
            <li>Select a card with the most pressing change.</li>
            <li>Click <strong>Generate recap</strong> to produce an executive summary.</li>
            <li>Review, edit if necessary, and press <strong>Publish</strong> to notify subscribers via email and Slack.</li>
          </ol>
        </div>
      </section>

      <section id="market-twin" className="documentation-section">
        <h2>Market Twin</h2>
        <p>Market Twin is LexyHub&apos;s simulation engine for scenario planning.</p>
        <ul>
          <li>
            <strong>Twin selector:</strong> Choose the marketplace twin you want to explore (e.g., Etsy, Amazon, Shopify).
          </li>
          <li>
            <strong>Scenario controls:</strong> Adjust inputs such as pricing, ad spend, or conversion modifiers to preview downstream
            impact.
          </li>
          <li>
            <strong>Outcome graphs:</strong> Compare baseline and simulated projections to guide planning conversations.
          </li>
        </ul>
        <div className="documentation-howto">
          <h3>How to run a demand scenario</h3>
          <ol>
            <li>Navigate to <strong>Market Twin</strong>.</li>
            <li>Select a target twin or create a new configuration.</li>
            <li>Adjust the available levers (pricing, inventory, marketing push).</li>
            <li>Inspect the projected revenue, margin, and operational constraints.</li>
            <li>Save the scenario to share it with stakeholders or iterate later.</li>
          </ol>
        </div>
      </section>

      <section id="settings" className="documentation-section">
        <h2>Settings</h2>
        <p>Settings centralize workspace administration.</p>
        <ul>
          <li>
            <strong>Plan &amp; billing:</strong> Review current subscription tier, invoices, and billing contacts.
          </li>
          <li>
            <strong>Integrations:</strong> Connect or troubleshoot data sources such as Etsy, Shopify, or internal APIs.
          </li>
          <li>
            <strong>Team management:</strong> Invite teammates, assign roles, and deactivate access when needed.
          </li>
          <li>
            <strong>Preferences:</strong> Update notification rules, language, and theme.
          </li>
        </ul>
        <div className="documentation-howto">
          <h3>How to invite a teammate</h3>
          <ol>
            <li>Open <strong>Settings → Team</strong>.</li>
            <li>Select <strong>Invite teammate</strong>.</li>
            <li>Enter their name, email, and role.</li>
            <li>Send the invite and monitor acceptance from the activity log.</li>
          </ol>
        </div>
      </section>

      <section id="status" className="documentation-section">
        <h2>Status page</h2>
        <p>The Status area communicates system uptime and scheduled maintenance.</p>
        <ul>
          <li>
            <strong>Current status banner:</strong> Shows overall service health.
          </li>
          <li>
            <strong>Incident timeline:</strong> Lists active and historical incidents with timestamps and mitigation notes.
          </li>
          <li>
            <strong>Subscribe controls:</strong> Users can subscribe to status updates through email or RSS.
          </li>
        </ul>
        <div className="documentation-howto">
          <h3>How to subscribe to status alerts</h3>
          <ol>
            <li>Visit <strong>Status</strong>.</li>
            <li>Click <strong>Subscribe</strong> and choose your preferred channel.</li>
            <li>Confirm the subscription request from the follow-up email.</li>
          </ol>
        </div>
      </section>

      <section id="notifications" className="documentation-section">
        <h2>Notifications &amp; themes</h2>
        <ul>
          <li>
            <strong>Notifications:</strong> Toasts appear for successes, warnings, and errors across the application. Access past
            notifications from the bell icon history.
          </li>
          <li>
            <strong>Themes:</strong> Switch between Light, Dark, and System modes using the theme picker in the user menu.
            Preferences persist per device.
          </li>
        </ul>
      </section>

      <section id="support" className="documentation-section">
        <h2>Help &amp; support</h2>
        <ul>
          <li>
            <strong>Help Center:</strong> Access this documentation from the help icon in the global user menu.
          </li>
          <li>
            <strong>Contact support:</strong> Email <code>support@lexyhub.ai</code> or open the in-app messenger (Settings → Support)
            for urgent issues.
          </li>
          <li>
            <strong>Feedback:</strong> Submit feature requests from Settings or by replying to any LexyHub email notification.
          </li>
        </ul>
      </section>

      <section id="troubleshooting" className="documentation-section">
        <h2>Troubleshooting</h2>
        <div className="documentation-table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Issue</th>
                <th scope="col">Resolution</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cannot sign in</td>
                <td>
                  Confirm you are using the approved SSO provider. If the issue persists, contact an administrator to verify your
                  seat assignment.
                </td>
              </tr>
              <tr>
                <td>Missing data in dashboards</td>
                <td>
                  Check the integration status in <strong>Settings → Integrations</strong> and reauthorize the connector if it shows an
                  error.
                </td>
              </tr>
              <tr>
                <td>Charts not loading</td>
                <td>
                  Refresh the page to ensure the latest deployment is applied. If the problem continues, reference the
                  <strong>Status</strong> page for ongoing incidents.
                </td>
              </tr>
              <tr>
                <td>Notifications are too noisy</td>
                <td>
                  Adjust notification preferences in <strong>Settings → Preferences</strong> or mute specific watchlists from the
                  Keywords area.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="resources" className="documentation-section">
        <h2>Additional resources</h2>
        <ul>
          <li>
            <a href={additionalResourceLinks.environmentSetup} target="_blank" rel="noreferrer">
              Environment setup
            </a>
          </li>
          <li>
            <a href={additionalResourceLinks.implementationRoadmap} target="_blank" rel="noreferrer">
              Implementation roadmap
            </a>
          </li>
          <li>
            <a href={additionalResourceLinks.etsyIntegration} target="_blank" rel="noreferrer">
              Etsy integration guide
            </a>
          </li>
          <li>
            <a href={additionalResourceLinks.trendIntentIntelligence} target="_blank" rel="noreferrer">
              Trend &amp; intent intelligence
            </a>
          </li>
          <li>
            <a href={additionalResourceLinks.statusPlaybook} target="_blank" rel="noreferrer">
              Platform status playbook
            </a>
          </li>
        </ul>
        <p>
          Release notes are maintained in
          {" "}
          <a href={additionalResourceLinks.changelog} target="_blank" rel="noreferrer">
            docs/changelog.md
          </a>
          . Review each sprint update to understand what has
          shipped, what changed, and any upcoming migrations.
        </p>
      </section>
    </article>
  );
}
