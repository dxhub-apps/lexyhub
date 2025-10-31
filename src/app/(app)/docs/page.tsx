import type { Metadata } from "next";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

const quickLinks = [
  {
    href: "#overview",
    label: "Overview",
    description: "Understand LexyHub’s purpose and who should use it.",
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
    href: "#watchlists",
    label: "Watchlists",
    description: "Track priority terms and listings with workspace actions or API calls.",
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
    <Stack spacing={3} component="article">
      <Card>
        <CardHeader
          title="LexyHub User Documentation"
          subheader="Explore every area of the platform, master critical workflows, and troubleshoot issues without leaving the app."
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary">
                Last updated
              </Typography>
              <Typography variant="body2">May 9, 2024</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary">
                Audience
              </Typography>
              <Typography variant="body2">Growth managers, operators, analysts, executives</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary">
                Support
              </Typography>
              <Typography variant="body2" component="a" href="mailto:support@lexyhub.ai">
                support@lexyhub.ai
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Quick links" />
        <CardContent>
          <Grid container spacing={2}>
            {quickLinks.map((link) => (
              <Grid item key={link.href} xs={12} sm={6} lg={4}>
                <Card variant="outlined" sx={{ height: "100%" }}>
                  <CardActionArea component="a" href={link.href} sx={{ height: "100%", alignItems: "stretch" }}>
                    <CardContent>
                      <Stack spacing={1}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {link.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {link.description}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card id="overview">
        <CardHeader title="Overview" />
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            LexyHub is the central workspace for monitoring sales velocity, discovering high-intent keywords, and coordinating
            market intelligence. This guide explains every surface of the product, recommended workflows, and troubleshooting
            steps so that new and existing teammates can become productive quickly.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The refreshed interface follows Material Design across every screen, so contained buttons, list actions, and chips
            consistently communicate what is interactive.
          </Typography>
          <Box component="ul" sx={{ pl: 3, color: "text.secondary" }}>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Audience:</strong> growth managers, marketplace operators, analysts, and executives using LexyHub to plan
              and execute marketplace strategies.
            </Typography>
            <Typography component="li" variant="body2">
              <strong>Prerequisites:</strong> an active LexyHub account and access to the data sources configured by your
              organization.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Card id="getting-started">
        <CardHeader title="Getting started" />
        <CardContent>
          <Box component="ol" sx={{ pl: 3, color: "text.secondary" }}>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Sign in:</strong> Visit the LexyHub URL provided by your administrator and authenticate with your work
              email. The avatar menu confirms the active plan and account.
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Select a workspace:</strong> If your organization manages multiple storefronts, choose the appropriate
              environment during sign in. All metrics and automations respect the selected workspace.
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Review onboarding alerts:</strong> The notification indicator in the top bar highlights setup tasks such
              as connecting an Etsy shop or approving data scopes.
            </Typography>
            <Typography component="li" variant="body2">
              <strong>Explore the app shell:</strong> The left navigation provides access to product areas, while the top bar
              shows platform status, environment labels, and the global user menu.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Card id="layout">
        <CardHeader title="Layout reference" />
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            LexyHub uses a responsive two-pane layout composed of:
          </Typography>
          <Box component="ul" sx={{ pl: 3, color: "text.secondary" }}>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Sidebar navigation:</strong> Links to Dashboard, Keywords, Insights, Market Twin, Settings, and Status.
              Collapse the sidebar with the toggle in the top-left corner; navigation automatically collapses on mobile
              breakpoints.
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Top bar:</strong> Displays the product name, contextual subtitle, environment (e.g., development, preview,
              production), a shortcut to the Status page, and the user menu.
            </Typography>
            <Typography component="li" variant="body2">
              <strong>User menu:</strong> Provides profile management, theme switching, how-to documentation, and a logout
              control. The menu stays consistent across every screen.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Card id="dashboard">
        <CardHeader title="Dashboard" />
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The Dashboard offers a high-level snapshot of revenue pacing and target attainment.
          </Typography>
          <Box component="ul" sx={{ pl: 3, color: "text.secondary" }}>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Quota pulse cards:</strong> Summaries of current sales versus quota, including leading indicators for Etsy
              and other marketplaces.
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Momentum charts:</strong> Visualize trailing performance windows and conversion trends. Hover a point to
              inspect underlying metrics.
            </Typography>
            <Typography component="li" variant="body2">
              <strong>Alerts feed:</strong> Lists noteworthy events such as inventory risks or policy changes. Use the
              Acknowledge control to dismiss resolved items.
            </Typography>
          </Box>
          <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              How to monitor revenue pacing
            </Typography>
            <Box component="ol" sx={{ pl: 3, color: "text.secondary" }}>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Navigate to <strong>Dashboard → Quota Pulse</strong>.
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Review the headline KPIs and confirm they align with the plan.
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Drill into the relevant chart to spot anomalies.
              </Typography>
              <Typography component="li" variant="body2">
                Share findings with stakeholders using the export option in the chart toolbar.
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card id="keywords">
        <CardHeader title="Keywords" />
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The Keywords workspace surfaces organic search opportunities discovered by LexyHub’s AI.
          </Typography>
          <Box component="ul" sx={{ pl: 3, color: "text.secondary" }}>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Opportunity table:</strong> Ranked list of recommended keywords, including demand score, competitive
              pressure, and suggested actions.
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Filters:</strong> Narrow the dataset by storefront, seasonality, or intent level.
            </Typography>
            <Typography component="li" variant="body2">
              <strong>Watchlists:</strong> Pin mission-critical keywords to monitor their movement over time.
            </Typography>
          </Box>
          <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              How to evaluate keyword opportunities
            </Typography>
            <Box component="ol" sx={{ pl: 3, color: "text.secondary" }}>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Navigate to <strong>Keywords → Opportunity table</strong>.
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Use filters to focus on the relevant market or intent type.
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Add promising terms to a watchlist to monitor performance.
              </Typography>
              <Typography component="li" variant="body2">
                Export selected keywords or send them to the Market Twin simulator for further analysis.
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card id="watchlists">
        <CardHeader title="Watchlists" />
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Watchlists capture the terms and listings that matter most. Material Design call-to-action buttons on the Watchlists
            page make it obvious how to add entries from the keywords workspace or via API.
          </Typography>
          <Box component="ul" sx={{ pl: 3, color: "text.secondary" }}>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Open keywords workspace:</strong> Use the contained button to jump directly into discovery and add
              opportunities with a single click.
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Review guide:</strong> The outlined button opens the in-depth watchlist workflow reference in a new tab.
            </Typography>
            <Typography component="li" variant="body2">
              <strong>API chip:</strong> The <code>POST /api/watchlists/add</code> label reinforces the endpoint to automate
              ingestion.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Card id="market-twin">
        <CardHeader title="Market Twin" />
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Market Twin compares your baseline Etsy listings against hypothetical upgrades to predict visibility shifts.
          </Typography>
          <Box component="ul" sx={{ pl: 3, color: "text.secondary" }}>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Simulation wizard:</strong> Configure scenario titles, price adjustments, and tag changes to see predicted
              visibility.
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              <strong>Baseline snapshot:</strong> Displays current listing metadata and demand signals.
            </Typography>
            <Typography component="li" variant="body2">
              <strong>Simulation history:</strong> View recently computed scenarios and compare their outcomes.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Card id="support">
        <CardHeader title="Help & support" />
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Need more guidance? Explore additional resources or reach out to the team.
          </Typography>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label="Docs" color="primary" variant="outlined" />
              <Typography variant="body2" component="a" href={additionalResourceLinks.environmentSetup} target="_blank" rel="noreferrer">
                Environment setup guide
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label="Roadmap" color="primary" variant="outlined" />
              <Typography variant="body2" component="a" href={additionalResourceLinks.implementationRoadmap} target="_blank" rel="noreferrer">
                Implementation roadmap
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label="Integration" color="primary" variant="outlined" />
              <Typography variant="body2" component="a" href={additionalResourceLinks.etsyIntegration} target="_blank" rel="noreferrer">
                Etsy integration playbook
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label="AI" color="primary" variant="outlined" />
              <Typography variant="body2" component="a" href={additionalResourceLinks.trendIntentIntelligence} target="_blank" rel="noreferrer">
                Trend & intent intelligence
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label="Status" color="primary" variant="outlined" />
              <Typography variant="body2" component="a" href={additionalResourceLinks.statusPlaybook} target="_blank" rel="noreferrer">
                Status page playbook
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label="Changelog" color="primary" variant="outlined" />
              <Typography variant="body2" component="a" href={additionalResourceLinks.changelog} target="_blank" rel="noreferrer">
                Product changelog
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
