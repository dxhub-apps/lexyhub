import Link from "next/link";
import { Card, CardContent, CardHeader, List, ListItem, Stack, Typography } from "@mui/material";

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
        <CardHeader title="Docs quick links" />
        <CardContent>
          <List>
            <ListItem disableGutters>
              <Typography component={Link} href="https://github.com/lexyhub/lexyhub/blob/main/docs/implementation-roadmap.md" target="_blank" rel="noreferrer">
                Implementation roadmap
              </Typography>
            </ListItem>
            <ListItem disableGutters>
              <Typography component={Link} href="https://supabase.com/docs" target="_blank" rel="noreferrer">
                Supabase docs
              </Typography>
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Stack>
  );
}
