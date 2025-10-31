"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Avatar,
  Box,
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  ComputerRounded,
  DarkModeRounded,
  ExpandMoreRounded,
  HelpOutlineRounded,
  LightModeRounded,
  LogoutRounded,
  PaletteRounded,
  PersonRounded,
} from "@mui/icons-material";

import { useTheme } from "@/components/theme/ThemeProvider";

const AVATAR_URL = "https://avatar.vercel.sh/lexyhub.svg?size=72&background=111827";

export function UserMenu(): JSX.Element {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleToggleTheme = (_: React.MouseEvent<HTMLElement>, value: typeof theme | null) => {
    if (value) {
      setTheme(value);
    }
  };

  const closeMenu = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    console.info("Logout requested");
    closeMenu();
  };

  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-haspopup="true"
        aria-expanded={open}
        endIcon={<ExpandMoreRounded />}
        sx={{
          textTransform: "none",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderRadius: 9999,
          pl: 0.5,
          pr: 1,
          py: 0.5,
        }}
      >
        <Avatar src={AVATAR_URL} alt="User avatar" sx={{ width: 36, height: 36 }} />
        <Box sx={{ textAlign: "left", display: { xs: "none", sm: "block" } }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Aaliyah
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Growth Scale Plan
          </Typography>
        </Box>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 280, borderRadius: 3 } } }}
      >
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Aaliyah Growth
          </Typography>
          <Typography variant="body2" color="text.secondary">
            aaliyah@lexyhub.ai
          </Typography>
        </Box>
        <Divider>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, py: 1 }}>
            <PaletteRounded fontSize="small" color="primary" />
            <Typography variant="caption" color="text.secondary">
              Theme
            </Typography>
          </Stack>
        </Divider>
        <Box sx={{ px: 2.5, py: 1.5 }}>
          <ToggleButtonGroup value={theme} exclusive onChange={handleToggleTheme} fullWidth color="primary">
            <ToggleButton value="light" aria-label="Use light theme">
              <LightModeRounded fontSize="small" />
            </ToggleButton>
            <ToggleButton value="dark" aria-label="Use dark theme">
              <DarkModeRounded fontSize="small" />
            </ToggleButton>
            <ToggleButton value="system" aria-label="Follow system theme">
              <ComputerRounded fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block", textAlign: "center" }}>
            Following {theme === "system" ? `system (${resolvedTheme})` : `${theme} preference`}
          </Typography>
        </Box>
        <Divider />
        <MenuItem component={Link} href="/profile" onClick={closeMenu}>
          <ListItemIcon>
            <PersonRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Profile" secondary="Manage account" />
        </MenuItem>
        <MenuItem component={Link} href="/docs" onClick={closeMenu}>
          <ListItemIcon>
            <HelpOutlineRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Help Center" secondary="Guides & how-tos" />
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Logout" secondary="End session" />
        </MenuItem>
      </Menu>
    </>
  );
}
