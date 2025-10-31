"use client";

import Link from "next/link";
import {
  AppBar,
  Button,
  Chip,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  ChevronLeftRounded,
  ChevronRightRounded,
  CloseRounded,
  MenuRounded,
} from "@mui/icons-material";

import { UserMenu } from "./UserMenu";
import type { SidebarNavItem } from "./Sidebar";

type TopbarProps = {
  isMobile: boolean;
  navOpen: boolean;
  onToggleNav: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  activeNavItem: SidebarNavItem;
};

export function Topbar({
  isMobile,
  navOpen,
  onToggleNav,
  onToggleSidebar,
  sidebarCollapsed,
  activeNavItem,
}: TopbarProps): JSX.Element {
  const environmentLabel =
    process.env.NEXT_PUBLIC_ENVIRONMENT ?? process.env.NODE_ENV ?? "production";

  const toggleLabel = isMobile
    ? navOpen
      ? "Hide navigation"
      : "Show navigation"
    : sidebarCollapsed
      ? "Expand sidebar"
      : "Collapse sidebar";

  const toggleIcon = isMobile
    ? navOpen
      ? <CloseRounded />
      : <MenuRounded />
    : sidebarCollapsed
      ? <ChevronRightRounded />
      : <ChevronLeftRounded />;

  return (
    <AppBar
      position="fixed"
      elevation={0}
      color="transparent"
      sx={{
        bgcolor: (theme) => theme.palette.background.paper,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        boxShadow: "none",
        backdropFilter: "blur(12px)",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between", gap: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton
            color="primary"
            onClick={isMobile ? onToggleNav : onToggleSidebar}
            aria-label={toggleLabel}
            aria-expanded={isMobile ? navOpen : !sidebarCollapsed}
          >
            {toggleIcon}
          </IconButton>
          <Stack spacing={0.5}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
              LexyHub Control Center
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {activeNavItem.label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {activeNavItem.description}
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip label={environmentLabel} color="primary" variant="outlined" size="small" sx={{ fontWeight: 600 }} />
          <Button
            component={Link}
            href="/docs"
            variant="outlined"
            color="primary"
            size="small"
          >
            Need help?
          </Button>
          <UserMenu />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
