export type NodeEnvironment = "development" | "test" | "production";

export type AppEnvironment = "local" | "development" | "staging" | "production";

export type RuntimeConfig = Readonly<{
  nodeEnv: NodeEnvironment;
  appEnv: AppEnvironment;
  appName: string;
  apiBaseUrl: string;
}>;

export type ApiErrorPayload = Readonly<{
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}>;

export type ApiSuccessPayload<TData> = Readonly<{
  data: TData;
  meta?: Record<string, unknown>;
}>;

export type ApiResponse<TData> = ApiSuccessPayload<TData> | ApiErrorPayload;
