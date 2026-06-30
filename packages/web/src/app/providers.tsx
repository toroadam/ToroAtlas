"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { RuntimeConfig } from "@/types/common";
import { reportError } from "@/lib/telemetry/error-reporting";

const RuntimeConfigContext = createContext<RuntimeConfig | null>(null);

type AppProvidersProps = Readonly<{
  children: ReactNode;
  runtimeConfig: RuntimeConfig;
}>;

export function AppProviders({
  children,
  runtimeConfig
}: AppProvidersProps): JSX.Element {
  useEffect(() => {
    const onUnhandledError = (event: ErrorEvent): void => {
      reportError(event.error ?? event.message, {
        source: "window.error",
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
      reportError(event.reason, {
        source: "window.unhandledrejection"
      });
    };

    window.addEventListener("error", onUnhandledError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onUnhandledError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return (
    <RuntimeConfigContext.Provider value={runtimeConfig}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig(): RuntimeConfig {
  const context = useContext(RuntimeConfigContext);
  if (!context) {
    throw new Error("useRuntimeConfig must be used within AppProviders.");
  }
  return context;
}
