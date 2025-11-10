# LexyHub User Documentation

## Overview
LexyHub is the central workspace for monitoring sales velocity, discovering high-intent keywords, and coordinating market intelligence. The interface has been refreshed with a simplified, hover-free presentation so navigation stays predictable on both desktop and touch devices. This guide explains every surface of the product, recommended workflows, and troubleshooting steps so that new and existing teammates can become productive quickly.

- **Audience:** growth managers, marketplace operators, analysts, and executives using LexyHub to plan and execute marketplace strategies.
- **Prerequisites:** an active LexyHub account and access to the data sources configured by your organization.

## Getting Started
1. **Sign in:** Visit the LexyHub URL (or `/login` directly), enter your Supabase credentials, and click **Sign in**. Sessions persist, so returning users skip the prompt until they explicitly log out. The avatar menu (top right) confirms the active admin plan and account details. The sign-in screen now establishes a Supabase session immediately, surfacing validation errors (such as incorrect passwords) without hanging so you always know whether authentication succeeded. Behind the scenes, LexyHub now double-checks the authenticated user directly with Supabase before unlocking the workspace, preventing tampered session data from granting access.
2. **Select a workspace:** If your organization manages multiple storefronts, use the workspace switcher presented during sign in to pick the correct environment. All metrics and automations respect the chosen workspace.
3. **Review onboarding alerts:** The notification bell in the workspace header highlights setup tasks such as connecting an Etsy shop or approving data scopes. Alerts will appear here once notifications launch.
4. **Explore the app shell:** The refreshed left navigation sidebar provides access to product areas, while the workspace header surfaces platform status, environment labels, quick help, streamlined quick actions, and the global user menu for settings and theme controls.

> **Admin-only surfaces**
>
> The Backoffice navigation group appears only for administrator accounts—either because the Supabase user metadata marks the user as an admin or because their email is listed in `LEXYHUB_ADMIN_EMAILS`. Standard users keep access to core analytics but are redirected away from `/admin/backoffice` URLs.

## Chrome extension setup

1. **Install the extension:** Download the latest build from **Settings → Downloads → Chrome extension** or load the unpacked folder from `apps/chrome-extension/dist` via `chrome://extensions` with **Developer mode** enabled.
2. **Approve permissions:** When prompted, review the scopes (`tabs`, `storage`, and `activeTab`) and click **Add extension**. These scopes allow LexyHub to read the active marketplace tab and cache session preferences locally.
3. **Generate an access token:** In the LexyHub web app, navigate to **Settings → API access** and press **Create Chrome token**. Copy the generated personal access token; it expires 30 days after creation.
4. **Store the token securely:** Open the extension popup, paste the token into the **LexyHub token** field, and click **Save**. Tokens are encrypted at rest in Chrome's storage but should still be rotated if you suspect compromise. Use the **Reset token** control in the extension to clear local storage when using a shared machine.
5. **Verify connection:** With an Etsy or marketplace listing open in Chrome, click the extension icon. A green status badge confirms the token is valid and the extension can call LexyHub APIs. If the badge is red, reissue the token or confirm the workspace domain matches the one stored in **Settings → API access**.

> **Token hygiene**
>
> Treat the Chrome token like a password. Do not paste it into shared chat tools. If a teammate needs access, generate a new token under their account so actions remain attributable. Tokens automatically scope to the workspaces you can access in LexyHub, preventing cross-account leakage.

## Layout Reference
LexyHub uses a responsive two-pane layout composed of:

- **Command sidebar:** Links to Dashboard, Watchlists, Keywords, Insights, Market Twin, Editing, Status, and Backoffice with clear descriptions so teammates understand what each section unlocks. The solid backgrounds and removal of hover-only feedback make link states legible in both light and dark themes. Collapse the sidebar using the toggle in the upper-left corner; the navigation automatically becomes a slide-over drawer on mobile breakpoints.
- **Workspace header:** Displays the product name, contextual subtitle for the active area, environment (e.g., `development`, `preview`, `production`), a quick "Need help?" shortcut to this guide, a notifications bell for upcoming alerts, and the user menu. The global search field has been removed so the header stays compact, and the controls now use consistent solid fills so actions remain obvious on touch devices. The mobile header exposes a menu button that opens the navigation drawer.
- **User menu:** Provides profile management, workspace settings, theme switching (via the Theme submenu), how-to documentation, and a logout control. Focus indicators replace hover effects so keyboard and touch users can clearly see the active option. Avatars render as crisp 36px circles and automatically fall back to the LexyHub default image if a custom photo fails to load, so the menu always shows a recognizable identity marker.
- **Full-width workspace canvas:** Main content pages now expand to the available width with subtle side padding, allowing dashboards, tables, and cards to line up cleanly without feeling boxed-in on large displays. Grids stretch their cards to equal heights so scanning related metrics is faster.

## Dashboard
The Dashboard offers a high-level snapshot of revenue pacing and target attainment.

- **Quota pulse cards:** Summaries of current sales versus quota, including leading indicators for Etsy and other marketplaces.
- **Momentum charts:** Visualize trailing performance windows and conversion trends. Hover a point to inspect underlying metrics.
- **Alerts feed:** Lists noteworthy events such as inventory risks or policy changes. Use the "Acknowledge" control to dismiss items that have been resolved.

**How to monitor revenue pacing:**
1. Navigate to **Dashboard → Quota Pulse**.
2. Review the headline KPIs and confirm they align with the plan.
3. Drill into the relevant chart to spot anomalies.
4. Share findings with stakeholders using the export option in the chart toolbar.

## Keywords
The Keywords workspace surfaces organic search opportunities discovered by LexyHub's AI.

- **Command-center search card:** Enter your idea, pick a market, toggle signal sources, and add an optional tag focus from a single responsive panel. Active filters render as removable chips, and the Reset action clears everything in one click.
- **Tab-based layout:** Switch between an **Overview** tab—with Helpful Highlights, sparkline telemetry, and lineage details—and an **Opportunities** tab dedicated to the sortable keyword table.
- **Priority opportunity banner:** When data is available, the table leads with a prominent callout that names the highest-momentum keyword, its source, and freshness timestamp so teams can focus immediately.
- **Rich opportunity table:** Every keyword row displays demand, competition, momentum, category context, and tags, alongside quick actions for adding items to watchlists or launching the AI tag optimizer.
- **Momentum playbook:** The Overview tab reinforces suggested next steps, surfaces the active tag emphasis, and keeps compliance notes about signals and freshness front and center.
- **Data seeding from real searches:** When a query returns no results, LexyHub captures the term and routes it to our enrichment queue so future searches populate faster.

**How to build a keyword watchlist:**
1. Open **Keywords** from the sidebar.
2. Run a search and adjust the Signals toggles so the dataset reflects your campaign goals.
3. Select the desired rows and click **Add to watchlist** in the Actions column.
4. Choose an existing watchlist or create a new one. Watchlists sync automatically with market updates.

## Watchlists
The Watchlists hub centralizes every monitored keyword or listing tied to your account.

- **Automatic provisioning:** When a user profile is created, LexyHub now creates an **Operational Watchlist** so new users can start tracking items immediately.
- **Friendly status summary:** The hero panel now explains how many watchlists you have and how many keywords they cover using approachable language instead of system metrics.
- **At-a-glance tracking:** Each card highlights how many keywords it monitors and when the list was last updated, so you can gauge freshness without digging into quotas.
- **Quota flexibility:** Administrators can apply overrides that include zero-valued limits when you need to pause watchlist growth without changing the underlying subscription plan.
- **Item controls:** Review the tracked keywords and listings, follow outbound links, and remove stale entries.
- **Listing coverage:** Listings stay linked to their marketplace counterparts, so watchlist details remain accurate even after catalog updates.

**How to prune a watchlist:**
1. Navigate to **Watchlists** in the sidebar.
2. Locate the card for the watchlist you want to adjust.
3. Click **Remove** next to the keyword or listing you no longer need to monitor.
4. Refresh the Keyword explorer to add replacements as needed.

## Insights
Insights consolidates narrative explanations, anomaly detection, and automated commentary.

- **Insight cards:** Each card outlines the context, the detected pattern, and the recommended response.
- **Narratives panel:** Provides generated summaries for stakeholder-ready reporting.
- **Collaboration tools:** Share an insight or tag a teammate for follow-up.

**How to publish an insight recap:**
1. Go to **Insights**.
2. Select a card with the most pressing change.
3. Click **Generate recap** to produce an executive summary.
4. Review, edit if necessary, and press **Publish** to notify subscribers via email and Slack.

## Market Twin
Market Twin is LexyHub's simulation engine for scenario planning.

- **Twin selector:** Choose the marketplace twin you want to explore (e.g., Etsy, Amazon, Shopify).
- **Scenario controls:** Adjust inputs such as pricing, ad spend, or conversion modifiers to preview downstream impact.
- **Outcome graphs:** Compare baseline and simulated projections to guide planning conversations.

**How to run a demand scenario:**
1. Navigate to **Market Twin**.
2. Select a target twin or create a new configuration.
3. Adjust the available levers (pricing, inventory, marketing push).
4. Inspect the projected revenue, margin, and operational constraints.
5. Save the scenario to share it with stakeholders or iterate later.

## Settings
Settings centralize workspace administration and are accessed from the avatar menu under **Settings**.

- **Plan & billing:** Review current subscription tier, invoices, and billing contacts.
- **Profile & billing center:** Refresh your avatar (stored in Vercel Blob), update your contact card, and review renewal status from a single responsive hub.
- **Integrations:** Connect or troubleshoot data sources such as Etsy, Shopify, or internal APIs.
- **Team management:** Invite teammates, assign roles, and deactivate access when needed.
- **Preferences:** Update notification rules, language, and theme.

**How to invite a teammate:**
1. Open **Settings** from the avatar menu, then choose **Team**.
2. Select **Invite teammate**.
3. Enter their name, email, and role.
4. Send the invite and monitor acceptance from the activity log.

**How to refresh your profile avatar:**
1. Open **Settings** from the avatar menu, then choose **Profile & Billing**.
2. Click **Change avatar** and pick a square PNG, JPG, or WebP file under 5 MB.
3. Wait for the toast confirmation—your photo is stored instantly in Vercel Blob and synced to Supabase.
4. Press **Save profile** if you also edited contact fields.

## Status Page
The Status area communicates current system health and highlights any degradations that may affect LexyHub.

- **Runtime snapshot:** Displays the latest heartbeat timestamp, environment, build identifier, and aggregated uptime so you can quickly confirm the platform is healthy.
- **API, service, and worker lists:** Each operational component reports its status, response time, and any queued jobs so you can isolate where an issue originates.
- **Incident monitoring:** Historical incidents are not listed on this page; instead, query `/api/status` or your organization's observability dashboards to review active or past incidents.

**How to check service health:**
1. Visit **Status** from the sidebar.
2. Review the runtime snapshot to validate overall uptime and deployment context.
3. Scan the API, service, and worker tables for components reporting warnings or errors.
4. If you need deeper incident details, request the `/api/status` endpoint or consult your observability tooling.

## Notifications & Themes
- **Notifications:** Toasts appear for successes, warnings, and errors across the application using consistent solid backgrounds that respect the current theme. The topbar bell prepares the surface for richer notification history that will land soon.
- **Themes:** Switch between Light, Dark, and System modes from the Theme submenu in the user menu. All surfaces—including cards, tables, and navigation—now share the same palette so light and dark experiences remain visually balanced. Preferences persist per device.

## Feedback
- **Quick access icon:** The top navigation now includes a speech bubble icon next to notifications. Click it from any page to open the feedback form without leaving your current workflow.
- **Submission form:** Choose whether you are reporting a bug, sharing an idea, or asking a question, then provide optional context such as impact and technical details. Submissions automatically capture the page URL to help the team reproduce issues faster.
- **Admin review:** Workspace administrators can review every submission from **Admin → Feedback**, filter by status or impact, and open detailed entries that include metadata, screenshots, and timestamps.

## Help & Support
- **Help Center:** Access this documentation from the new "Need help?" shortcut in the workspace header or the help icon in the global user menu.
- **Contact support:** Email `support@lexyhub.ai` or open the in-app messenger (Settings → Support) for urgent issues.
- **Feedback:** Use the topbar feedback button or visit **Settings → Support** to share ideas and report issues. Replies to LexyHub email notifications still route to the support team if you prefer email.

## Troubleshooting
| Issue | Resolution |
| --- | --- |
| Cannot sign in | Confirm you are using the approved SSO provider. If the issue persists, contact an administrator to verify your seat assignment. |
| Missing data in dashboards | Check the integration status in **Settings → Integrations** and reauthorize the connector if it shows an error. |
| Charts not loading | Refresh the page to ensure the latest deployment is applied. If the problem continues, reference the **Status** page for ongoing incidents. |
| Notifications are too noisy | Adjust notification preferences in **Settings → Preferences** or mute specific watchlists from the Keywords area. |

## Release Notes & Changelog
LexyHub publishes sprint-level release notes in `/docs/changelog.md`. Review the changelog to understand upcoming changes, deprecations, and beta features.

## Additional Resources
- **Environment setup:** `/docs/environment-setup.md`
- **Implementation roadmap:** `/docs/implementation-roadmap.md`
- **Etsy integration guide:** `/docs/etsy-integration.md`
- **Amazon keyword population guide:** `/docs/amazon-keyword-population-guide.md`
- **Trend & intent intelligence:** `/docs/trend-intent-intelligence.md`

_Last updated: 2025-07-17_
