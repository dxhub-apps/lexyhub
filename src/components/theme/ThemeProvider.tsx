"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CssBaseline, ThemeProvider as MuiThemeProvider, createTheme, responsiveFontSizes } from "@mui/material";

export type ThemeOption = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: ThemeOption;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeOption) => void;
};

const STORAGE_KEY = "lexyhub.theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = theme;
}

function createLexyTheme(mode: "light" | "dark") {
  const palette =
    mode === "light"
      ? {
          mode,
          primary: { main: "#1E88E5" },
          secondary: { main: "#8E24AA" },
          background: { default: "#EDF1F7", paper: "#FFFFFF" },
          text: { primary: "#102038", secondary: "#4F5B76" },
        }
      : {
          mode,
          primary: { main: "#64B5F6" },
          secondary: { main: "#CE93D8" },
          background: { default: "#0E1321", paper: "#171D2E" },
          text: { primary: "#F4F7FB", secondary: "#BAC4DC" },
        };

  const shape = { borderRadius: 12 } as const;
  const divider = mode === "light" ? "rgba(16, 32, 56, 0.12)" : "rgba(226, 232, 240, 0.16)";
  const hoverOverlay = mode === "light" ? "rgba(30, 136, 229, 0.08)" : "rgba(100, 181, 246, 0.16)";
  const listItemSelected = mode === "light" ? "rgba(30, 136, 229, 0.16)" : "rgba(100, 181, 246, 0.24)";
  const primaryContrast = mode === "light" ? "#0B172B" : "#FFFFFF";

  return responsiveFontSizes(
    createTheme({
      palette,
      typography: {
        fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
        h1: { fontSize: "2.25rem", fontWeight: 600 },
        h2: { fontSize: "1.75rem", fontWeight: 600 },
        h3: { fontSize: "1.5rem", fontWeight: 600 },
        subtitle1: { fontWeight: 500 },
        button: { textTransform: "none", fontWeight: 600 },
      },
      shape,
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: shape.borderRadius,
              paddingInline: 20,
              paddingBlock: 10,
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: shape.borderRadius,
              boxShadow: mode === "light" ? "0 10px 40px rgba(16,32,56,0.08)" : "0 16px 40px rgba(0,0,0,0.35)",
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              borderRadius: shape.borderRadius,
            },
          },
        },
        MuiCardActionArea: {
          styleOverrides: {
            root: {
              borderRadius: shape.borderRadius,
              transition: "transform 120ms ease", // subtle scale for clickable surfaces
              '&:hover': {
                transform: "translateY(-2px)",
              },
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            colorPrimary: {
              backgroundImage: "none",
            },
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              backgroundImage: "none",
            },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              borderRadius: shape.borderRadius,
              marginBottom: 4,
              transition: "background-color 160ms ease, transform 160ms ease", // emphasise clickable
              '&:hover': {
                backgroundColor: hoverOverlay,
                transform: "translateX(4px)",
              },
              '&.Mui-selected': {
                backgroundColor: listItemSelected,
                color: primaryContrast,
                '&:hover': {
                  backgroundColor: listItemSelected,
                },
              },
            },
          },
        },
        MuiToggleButton: {
          styleOverrides: {
            root: {
              borderRadius: shape.borderRadius,
            },
          },
        },
        MuiToggleButtonGroup: {
          styleOverrides: {
            root: {
              borderRadius: shape.borderRadius,
              padding: 4,
              backgroundColor: mode === "light" ? "#F3F6FC" : "rgba(148, 163, 184, 0.12)",
            },
          },
        },
        MuiLink: {
          defaultProps: {
            underline: "hover",
          },
          styleOverrides: {
            root: {
              fontWeight: 600,
              color: palette.primary.main,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              fontWeight: 600,
              borderRadius: shape.borderRadius,
            },
          },
        },
        MuiTableHead: {
          styleOverrides: {
            root: {
              backgroundColor: mode === "light" ? "#F3F6FC" : "rgba(148, 163, 184, 0.12)",
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              borderBottom: `1px solid ${divider}`,
            },
            head: {
              fontWeight: 600,
              textTransform: "uppercase",
              fontSize: "0.75rem",
              letterSpacing: 0.5,
              color: mode === "light" ? "#1F2A44" : "#E2E8F0",
            },
          },
        },
        MuiDivider: {
          styleOverrides: {
            root: {
              borderColor: divider,
            },
          },
        },
        MuiTypography: {
          styleOverrides: {
            root: {
              '&[role="link"]': {
                fontWeight: 600,
              },
            },
          },
        },
      },
    }),
  );
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<ThemeOption>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeOption | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const systemTheme = getSystemTheme();
    const nextResolved = theme === "system" ? systemTheme : theme;
    setResolvedTheme(nextResolved);
    applyTheme(nextResolved);

    if (theme === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (theme !== "system") {
        return;
      }
      const systemTheme = getSystemTheme();
      setResolvedTheme(systemTheme);
      applyTheme(systemTheme);
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback((value: ThemeOption) => {
    setThemeState(value);
  }, []);

  const materialTheme = useMemo(() => createLexyTheme(resolvedTheme), [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={materialTheme}>
        <CssBaseline enableColorScheme />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
