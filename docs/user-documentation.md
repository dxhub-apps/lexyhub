# LexyHub User Documentation

## Overview
LexyHub is the central workspace for monitoring sales velocity, discovering high-intent keywords, and coordinating market intelligence. The interface now follows Material Design across every screen—solid buttons, card actions, and chips highlight exactly what is interactive on both desktop and touch devices. This guide explains every surface of the product, recommended workflows, and troubleshooting steps so that new and existing teammates can become productive quickly.

- **Audience:** growth managers, marketplace operators, analysts, and executives using LexyHub to plan and execute marketplace strategies.
- **Prerequisites:** an active LexyHub account and access to the data sources configured by your organization.

## Getting Started
1. **Sign in:** Visit the LexyHub URL provided by your administrator and authenticate with your work email. The avatar menu (top right) confirms the active plan and account.
2. **Select a workspace:** If your organization manages multiple storefronts, use the workspace switcher presented during sign in to pick the correct environment. All metrics and automations respect the chosen workspace.
3. **Review onboarding alerts:** The notification indicator in the workspace header highlights setup tasks such as connecting an Etsy shop or approving data scopes.
4. **Explore the app shell:** The refreshed left navigation sidebar provides access to product areas, while the workspace header surfaces platform status, environment labels, quick help, and the global user menu.

## Layout Reference
LexyHub uses a responsive two-pane layout composed of:

- **Command sidebar:** Links to Dashboard, Watchlists, Keywords, Insights, Market Twin, Settings, and Status with clear descriptions so teammates understand what each section unlocks. The solid backgrounds and removal of hover-only feedback make link states legible in both light and dark themes. Collapse the sidebar using the toggle in the upper-left corner; the navigation automatically becomes a slide-over drawer on mobile breakpoints.
- **Workspace header:** Displays the product name, contextual subtitle for the active area, environment (e.g., `development`, `preview`, `production`), a quick "Need help?" shortcut to this guide, and the user menu. The header controls now use consistent solid fills so actions remain obvious on touch devices. The mobile header exposes a menu button that opens the navigation drawer.
- **User menu:** Provides profile management, theme switching, how-to documentation, and a logout control. Focus indicators replace hover effects so keyboard and touch users can clearly see the active option.

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

- **Opportunity table:** Ranked list of recommended keywords, including demand score, competitive pressure, and suggested actions.
- **Filters:** Narrow the dataset by storefront, seasonality, or intent level. The **Plan tier** selector now mirrors the active subscription in the request payload and automatically limits the available data sources so teams always understand which providers power the current view.
- **Watchlists:** Pin mission-critical keywords to monitor their movement over time.
- **Helpful Highlights panel:** Shows friendly tips about your keyword search along with the last time guidance was updated.
- **Data Info card:** Audits the plan returned by the latest search, active data sources, freshest sync timestamp, and total records so analysts can confirm the dataset lineage at a glance.
- **Data seeding from real searches:** When a query returns no results, LexyHub now captures the term and routes it to our enrichment queue so future searches populate faster.

**How to build a keyword watchlist:**
1. Open **Keywords** from the sidebar.
2. Apply filters that reflect your campaign goals.
3. Select the desired rows and click **Add to watchlist**.
4. Choose an existing watchlist or create a new one. Watchlists sync automatically with market updates.

## Watchlists
The Watchlists hub centralizes every monitored keyword or listing tied to your account.

- **Automatic provisioning:** When a user profile is created, LexyHub now creates an **Operational Watchlist** so new users can start tracking items immediately.
- **Capacity overview:** Each card shows how many slots are in use, remaining capacity, and the watchlist description.
- **Item controls:** Review the tracked keywords and listings, follow outbound links, and remove stale entries.
- **Listing coverage:** Listings stay linked to their marketplace counterparts, so watchlist details remain accurate even after catalog updates.
- **Material quick actions:** A contained **Open keywords workspace** button, outlined **Review guide** button, and **POST /api/watchlists/add** chip clarify how to curate watchlists manually or programmatically.

**How to prune a watchlist:**
1. Navigate to **Watchlists** in the sidebar.
2. Locate the card for the watchlist you want to adjust.
3. Click **Remove** next to the keyword or listing you no longer need to monitor.
4. Refresh the Keyword explorer to add replacements as needed.
5. Use **Review guide** to open the watchlist workflow reference if you need additional context.

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
Settings centralize workspace administration.

- **Plan & billing:** Review current subscription tier, invoices, and billing contacts.
- **Integrations:** Connect or troubleshoot data sources such as Etsy, Shopify, or internal APIs.
- **Team management:** Invite teammates, assign roles, and deactivate access when needed.
- **Preferences:** Update notification rules, language, and theme.

**How to invite a teammate:**
1. Open **Settings → Team**.
2. Select **Invite teammate**.
3. Enter their name, email, and role.
4. Send the invite and monitor acceptance from the activity log.

## Status Page
The Status area communicates system uptime and scheduled maintenance.

- **Current status banner:** Shows overall service health.
- **Incident timeline:** Lists active and historical incidents with timestamps and mitigation notes.
- **Subscribe controls:** Users can subscribe to status updates through email or RSS.

**How to subscribe to status alerts:**
1. Visit **Status**.
2. Click **Subscribe** and choose your preferred channel.
3. Confirm the subscription request from the follow-up email.

## Notifications & Themes
- **Notifications:** Toasts appear for successes, warnings, and errors across the application using consistent solid backgrounds that respect the current theme. Access past notifications from the bell icon history.
- **Themes:** Switch between Light, Dark, and System modes using the theme picker in the user menu. All surfaces—including cards, tables, and navigation—now share the same palette so light and dark experiences remain visually balanced. Preferences persist per device.

## Help & Support
- **Help Center:** Access this documentation from the new "Need help?" shortcut in the workspace header or the help icon in the global user menu.
- **Contact support:** Email `support@lexyhub.ai` or open the in-app messenger (Settings → Support) for urgent issues.
- **Feedback:** Submit feature requests from Settings or by replying to any LexyHub email notification.

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

_Last updated: 2025-07-14_
