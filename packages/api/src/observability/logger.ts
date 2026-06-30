export type LogLevel = "debug" | "info" | "warn" | "error";

export type Logger = {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
};

type StructuredLogEntry = {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  metadata: Record<string, unknown>;
};

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function normalizeLogLevel(input: string | undefined): LogLevel {
  if (input === "debug" || input === "info" || input === "warn" || input === "error") {
    return input;
  }
  return "info";
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
}

function shouldLog(level: LogLevel, minimumLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minimumLevel];
}

export function createLogger(
  component: string,
  defaultMetadata: Record<string, unknown> = {},
): Logger {
  const minimumLevel = normalizeLogLevel(process.env.LOG_LEVEL);

  const write = (level: LogLevel, message: string, metadata: Record<string, unknown> = {}): void => {
    if (!shouldLog(level, minimumLevel)) {
      return;
    }

    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      metadata: sanitizeMetadata({
        ...defaultMetadata,
        ...metadata,
      }),
    };

    const serializedEntry = JSON.stringify(entry);
    if (level === "error") {
      console.error(serializedEntry);
      return;
    }

    if (level === "warn") {
      console.warn(serializedEntry);
      return;
    }

    console.log(serializedEntry);
  };

  return {
    debug(message, metadata) {
      write("debug", message, metadata);
    },
    info(message, metadata) {
      write("info", message, metadata);
    },
    warn(message, metadata) {
      write("warn", message, metadata);
    },
    error(message, metadata) {
      write("error", message, metadata);
    },
  };
}
