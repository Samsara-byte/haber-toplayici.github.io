import { NextResponse } from "next/server";
import { getScraper, runScraper } from "@/lib/scrapers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { site: string } },
) {
  try {
    const scraper = getScraper(params.site);
    const news = await runScraper(scraper);
    return NextResponse.json({
      success: true,
      site: params.site,
      site_display_name: scraper.siteName,
      count: news.length,
      news,
    });
  } catch (e) {
    const isNotFound = String(e).includes("bulunamadı");
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: isNotFound ? 404 : 500 },
    );
  }
}
