import { NextResponse } from "next/server";

type WebHealthPayload = {
  status: "ok" | "degraded";
  service: "web";
  timestamp: string;
  checks: {
    runtimeStable: boolean;
    apiBaseUrlConfigured: boolean;
  };
};

export async function GET(): Promise<NextResponse<{ data: WebHealthPayload }>> {
  const apiBaseUrlConfigured =
    typeof process.env.NEXT_PUBLIC_API_BASE_URL === "string" &&
    process.env.NEXT_PUBLIC_API_BASE_URL.trim().length > 0;

  const payload: WebHealthPayload = {
    status: apiBaseUrlConfigured ? "ok" : "degraded",
    service: "web",
    timestamp: new Date().toISOString(),
    checks: {
      runtimeStable: true,
      apiBaseUrlConfigured,
    },
  };

  return NextResponse.json(
    {
      data: payload,
    },
    {
      status: payload.status === "ok" ? 200 : 503,
    },
  );
}
