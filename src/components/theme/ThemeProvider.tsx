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
