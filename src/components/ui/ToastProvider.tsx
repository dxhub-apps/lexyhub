"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Alert, AlertTitle, Box, Collapse, Stack } from "@mui/material";

type Toast = {
  id: string;
  title: string;
  description?: string;
  tone?: "info" | "success" | "warning" | "error";
  duration?: number;
};

type ToastContextValue = {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function useToastLifecycle(toasts: Toast[], dismiss: (id: string) => void): void {
  useEffect(() => {
    const timers = toasts.map((toast) => {
      const timeout = toast.duration ?? 5000;
      return window.setTimeout(() => dismiss(toast.id), timeout);
    });

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [toasts, dismiss]);
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback<ToastContextValue["push"]>((toast) => {
    counter.current += 1;
    const id = `${Date.now()}-${counter.current}`;
    setToasts((current) => [...current, { ...toast, id }]);
  }, []);

  useToastLifecycle(toasts, dismiss);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, push, dismiss }),
    [toasts, push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Box
        role="status"
        aria-live="polite"
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          zIndex: (theme) => theme.zIndex.snackbar,
          width: "min(360px, calc(100vw - 32px))",
        }}
      >
        <Stack spacing={2}>
          {toasts.map((toast) => (
            <Collapse key={toast.id} in>
              <Alert
                severity={toast.tone ?? "info"}
                variant="filled"
                onClose={() => dismiss(toast.id)}
                sx={{ alignItems: "flex-start" }}
              >
                <AlertTitle>{toast.title}</AlertTitle>
                {toast.description ?? null}
              </Alert>
            </Collapse>
          ))}
        </Stack>
      </Box>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
