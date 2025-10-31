import { Card, CardContent, CardHeader, Divider, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Stack, Typography } from "@mui/material";
import { ArticleRounded, HelpOutlineRounded, OpenInNewRounded } from "@mui/icons-material";

export default function SettingsPage() {
  return (
    <Stack spacing={3} maxWidth={640}>
      <Card>
        <CardHeader
          title="Environment Settings"
          subheader="Manage provider credentials, integration secrets, and readiness tasks for your production workspace."
        />
      </Card>
      <Card>
        <CardHeader title="Docs quick links" subheader="Open frequently referenced setup guides." />
        <CardContent sx={{ px: 0 }}>
          <List disablePadding>
            <ListItem disablePadding>
              <ListItemButton
                component="a"
                href="https://github.com/lexyhub/lexyhub/blob/main/docs/implementation-roadmap.md"
                target="_blank"
                rel="noreferrer"
              >
                <ListItemIcon>
                  <ArticleRounded fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Implementation roadmap"
                  secondary="Step-by-step milestones for rollout"
                  secondaryTypographyProps={{ color: "text.secondary" }}
                />
                <OpenInNewRounded fontSize="small" color="disabled" />
              </ListItemButton>
            </ListItem>
            <Divider component="li" />
            <ListItem disablePadding>
              <ListItemButton component="a" href="https://supabase.com/docs" target="_blank" rel="noreferrer">
                <ListItemIcon>
                  <HelpOutlineRounded fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Supabase docs"
                  secondary="Reference for data platform configuration"
                  secondaryTypographyProps={{ color: "text.secondary" }}
                />
                <OpenInNewRounded fontSize="small" color="disabled" />
              </ListItemButton>
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Stack>
  );
}
