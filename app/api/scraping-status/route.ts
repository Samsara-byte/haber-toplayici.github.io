import { NextResponse } from "next/server";
import { buildStatusResponse } from "@/lib/scraping-state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildStatusResponse());
}
