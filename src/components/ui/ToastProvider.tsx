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
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            className={`toast toast-${toast.tone ?? "info"}`}
            onClick={() => dismiss(toast.id)}
          >
            <strong>{toast.title}</strong>
            {toast.description ? <span>{toast.description}</span> : null}
          </button>
        ))}
      </div>
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
