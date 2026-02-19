import { NextResponse } from "next/server";
import {
  getScrapingState,
  resetScrapingState,
  addNews,
  addError,
  updateProgress,
  completeScraping,
  failScraping,
  setSiteStatus,
} from "@/lib/scraping-state";
import { getAllScrapers, runScraper } from "@/lib/scrapers";
import { NewsItem } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = getScrapingState();

  if (state.is_scraping) {
    return NextResponse.json({
      success: false,
      error: "Scraping zaten devam ediyor",
    });
  }

  const scrapers = getAllScrapers();
  resetScrapingState(scrapers.map((s) => s.siteName));

  scrapeAllSites(scrapers).catch((err) => {
    console.error("❌ Scraping hatası:", err);
    failScraping(String(err));
  });

  return NextResponse.json({ success: true, message: "Scraping başlatıldı" });
}

async function scrapeAllSites(
  scrapers: ReturnType<typeof getAllScrapers>,
): Promise<void> {
  if (scrapers.length === 0) {
    addError("Aktif scraper bulunamadı");
    completeScraping();
    return;
  }

  const allNews: NewsItem[] = [];
  let completed = 0;

  updateProgress(0, "Tüm siteler paralel taranıyor...");

  await Promise.allSettled(
    scrapers.map(async (scraper) => {
      setSiteStatus(scraper.siteName, "running");
      try {
        const news = await runScraper(scraper);
        completed++;
        addNews(news);
        allNews.push(...news);
        setSiteStatus(scraper.siteName, "done", news.length);
        updateProgress(
          Math.round((completed / scrapers.length) * 100),
          `${scraper.siteName} tamamlandı (${completed}/${scrapers.length})`,
        );
        console.log(`✅ ${scraper.siteName}: ${news.length} haber`);
      } catch (e) {
        completed++;
        const errMsg = `${scraper.siteName}: ${String(e)}`;
        addError(errMsg);
        setSiteStatus(scraper.siteName, "error", 0);
        updateProgress(
          Math.round((completed / scrapers.length) * 100),
          `${scraper.siteName} hata aldı (${completed}/${scrapers.length})`,
        );
        console.error(`❌ ${errMsg}`);
      }
    }),
  );

  allNews.sort(
    (a, b) =>
      new Date(b.parsed_date).getTime() - new Date(a.parsed_date).getTime(),
  );

  completeScraping();
}
