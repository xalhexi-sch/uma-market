import { NextResponse } from "next/server";

/**
 * Health check endpoint for deployment verification.
 *
 * Returns basic application status — used by monitoring, deployment
 * pipelines, and manual production verification.
 *
 * Does NOT check database connectivity (which would add latency
 * and create a dependency on Supabase for health checks).
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
