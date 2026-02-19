import { NextResponse } from "next/server";
import { Config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sites = Object.entries(Config.SITES).map(([id, cfg]) => ({
      id,
      name: cfg.name,
      enabled: cfg.enabled,
      base_url: cfg.base_url,
      color: cfg.color,
      category: cfg.category,
    }));
    return NextResponse.json({ success: true, count: sites.length, sites });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 },
    );
  }
}
