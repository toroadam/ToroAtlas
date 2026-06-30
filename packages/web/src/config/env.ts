import type { AppEnvironment, NodeEnvironment, RuntimeConfig } from "@/types/common";

const APP_ENVIRONMENTS: AppEnvironment[] = [
  "local",
  "development",
  "staging",
  "production"
];

const NODE_ENVIRONMENTS: NodeEnvironment[] = ["development", "test", "production"];

const SCAFFOLD_DEFAULTS = {
  NEXT_PUBLIC_APP_ENV: "local",
  NEXT_PUBLIC_APP_NAME: "ToroAtlas UX Tool",
  NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001"
} as const;

const warnedFallbackKeys = new Set<string>();

function warnScaffoldFallback(key: string, fallback: string): void {
  if (warnedFallbackKeys.has(key)) {
    return;
  }

  warnedFallbackKeys.add(key);
  console.warn(
    `[env] ${key} is not set. Using scaffold default "${fallback}". Copy packages/web/.env.example to packages/web/.env.local and update values for your environment.`
  );
}

function getEnvValueOrScaffoldDefault(
  key: keyof typeof SCAFFOLD_DEFAULTS,
  value: string | undefined
): string {
  if (value && value.trim().length > 0) {
    return value.trim();
  }

  const fallback = SCAFFOLD_DEFAULTS[key];
  warnScaffoldFallback(key, fallback);
  return fallback;
}

function parseNodeEnv(value: string | undefined): NodeEnvironment {
  const normalized = value ?? "development";
  if (!NODE_ENVIRONMENTS.includes(normalized as NodeEnvironment)) {
    throw new Error(
      `[env] Invalid NODE_ENV value "${normalized}". Expected one of: ${NODE_ENVIRONMENTS.join(", ")}.`
    );
  }
  return normalized as NodeEnvironment;
}

function parseAppEnv(value: string): AppEnvironment {
  if (!APP_ENVIRONMENTS.includes(value as AppEnvironment)) {
    throw new Error(
      `[env] Invalid NEXT_PUBLIC_APP_ENV value "${value}". Expected one of: ${APP_ENVIRONMENTS.join(", ")}.`
    );
  }
  return value as AppEnvironment;
}

let cachedConfig: RuntimeConfig | null = null;

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
  const appEnv = parseAppEnv(
    getEnvValueOrScaffoldDefault("NEXT_PUBLIC_APP_ENV", process.env.NEXT_PUBLIC_APP_ENV)
  );
  const appName = getEnvValueOrScaffoldDefault(
    "NEXT_PUBLIC_APP_NAME",
    process.env.NEXT_PUBLIC_APP_NAME
  );
  const apiBaseUrl = getEnvValueOrScaffoldDefault(
    "NEXT_PUBLIC_API_BASE_URL",
    process.env.NEXT_PUBLIC_API_BASE_URL
  );

  cachedConfig = {
    nodeEnv,
    appEnv,
    appName,
    apiBaseUrl
  };

  return cachedConfig;
}
