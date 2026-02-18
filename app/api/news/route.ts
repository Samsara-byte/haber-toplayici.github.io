import { NextResponse } from "next/server";
import { getAllScrapers, runScraper } from "@/lib/scrapers";
import { NewsItem } from "@/types";

export async function GET() {
  try {
    const allNews: NewsItem[] = [];
    const scrapers = getAllScrapers();

    await Promise.allSettled(
      scrapers.map(async (scraper) => {
        try {
          const news = await runScraper(scraper);
          allNews.push(...news);
        } catch (e) {
          console.error(`❌ ${scraper.siteName}:`, e);
        }
      }),
    );

    allNews.sort(
      (a, b) =>
        new Date(b.parsed_date).getTime() - new Date(a.parsed_date).getTime(),
    );

    return NextResponse.json({
      success: true,
      count: allNews.length,
      news: allNews,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 },
    );
  }
}
