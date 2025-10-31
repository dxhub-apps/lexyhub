"use client";

import { type ElementType } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import {
  ChevronLeftRounded,
  ChevronRightRounded,
  CloseRounded,
} from "@mui/icons-material";

export type SidebarNavItem = {
  href: string;
  label: string;
  description: string;
  icon: ElementType;
};

type SidebarProps = {
  navItems: readonly SidebarNavItem[];
  pathname: string;
  collapsed: boolean;
  isMobile: boolean;
  navOpen: boolean;
  width: number;
  onToggleCollapse: () => void;
  onDismissMobile: () => void;
};

const NAV_TITLE = "LexyHub";
const NAV_TAGLINE = "Growth intelligence";

export function Sidebar({
  navItems,
  pathname,
  collapsed,
  isMobile,
  navOpen,
  width,
  onToggleCollapse,
  onDismissMobile,
}: SidebarProps): JSX.Element {
  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname.startsWith("/dashboard");
    }
    if (href === "/admin/backoffice") {
      return pathname.startsWith("/admin/backoffice");
    }
    return pathname.startsWith(href);
  };

  const handleNavClick = () => {
    if (isMobile) {
      onDismissMobile();
    }
  };

  const content = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          px: 3,
          py: 3,
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: collapsed ? "center" : "flex-start" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {NAV_TITLE}
          </Typography>
          {!collapsed ? (
            <Typography variant="body2" color="text.secondary">
              {NAV_TAGLINE}
            </Typography>
          ) : null}
        </Box>
        <IconButton
          color="primary"
          onClick={isMobile ? onDismissMobile : onToggleCollapse}
          aria-label={isMobile ? "Close navigation" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          size="small"
        >
          {isMobile ? <CloseRounded /> : collapsed ? <ChevronRightRounded /> : <ChevronLeftRounded />}
        </IconButton>
      </Box>
      {!collapsed ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 2 }}>
          Your command center for AI growth operations.
        </Typography>
      ) : null}
      <Divider sx={{ mx: 3 }} />
      <List sx={{ flexGrow: 1, py: 2, px: collapsed ? 1.2 : 2 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={active}
              onClick={handleNavClick}
              sx={{
                mb: 0.5,
                borderRadius: 2,
                px: collapsed ? 1.2 : 2,
                justifyContent: collapsed ? "center" : "flex-start",
                '&.Mui-selected': {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  '&:hover': { bgcolor: "primary.main" },
                  '& .MuiListItemIcon-root': { color: "inherit" },
                  '& .MuiTypography-root': { color: "inherit" },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? 0 : 40,
                  color: active ? "inherit" : "text.secondary",
                  justifyContent: "center",
                }}
              >
                <Icon fontSize="small" />
              </ListItemIcon>
              {!collapsed ? (
                <ListItemText
                  primary={item.label}
                  secondary={item.description}
                  primaryTypographyProps={{ fontWeight: active ? 700 : 600 }}
                  secondaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                />
              ) : null}
            </ListItemButton>
          );
        })}
      </List>
      {!collapsed ? (
        <Box sx={{ px: 3, pb: 3 }}>
          <Box
            sx={{
              bgcolor: (theme) => theme.palette.mode === "light" ? "primary.light" : "primary.dark",
              color: (theme) => theme.palette.getContrastText(theme.palette.primary.main),
              p: 2.5,
              borderRadius: 3,
              textAlign: "left",
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Need more seats?
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.92, mb: 2 }}>
              Upgrade your plan to unlock full market intelligence coverage.
            </Typography>
            <Button
              component={Link}
              href="/settings"
              variant="contained"
              color="secondary"
              size="small"
              fullWidth
            >
              Manage plan
            </Button>
          </Box>
        </Box>
      ) : null}
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={navOpen}
        onClose={onDismissMobile}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", lg: "none" },
          '& .MuiDrawer-paper': {
            width: 320,
            boxSizing: "border-box",
            borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      open
      sx={{
        width,
        flexShrink: 0,
        display: { xs: "none", lg: "block" },
        '& .MuiDrawer-paper': {
          width,
          boxSizing: "border-box",
          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      {content}
    </Drawer>
  );
}
