import { NextResponse } from "next/server";
import {
  getScrapingState,
  resetScrapingState,
  addNews,
  addError,
  updateProgress,
  completeScraping,
  failScraping,
} from "@/lib/scraping-state";
import { getAllScrapers, runScraper } from "@/lib/scrapers";
import { NewsItem } from "@/types";

export async function GET() {
  const state = getScrapingState();

  if (state.is_scraping) {
    return NextResponse.json({
      success: false,
      error: "Scraping zaten devam ediyor",
    });
  }

  resetScrapingState();

  // Background'da başlat, await etme
  scrapeAllSites().catch((err) => {
    console.error("❌ Scraping hatası:", err);
    failScraping(String(err));
  });

  return NextResponse.json({ success: true, message: "Scraping başlatıldı" });
}

async function scrapeAllSites(): Promise<void> {
  const scrapers = getAllScrapers();

  if (scrapers.length === 0) {
    addError("Aktif scraper bulunamadı");
    completeScraping();
    return;
  }

  // ============================================================
  // ANA HIZ OPTİMİZASYONU: Tüm siteler aynı anda paralel çalışır
  // Flask'ta sıralıydı (1→2→3→...), burada hepsi aynı anda başlar
  // ============================================================
  updateProgress(0, "Tüm siteler paralel taranıyor...");

  const allNews: NewsItem[] = [];
  let completed = 0;

  const results = await Promise.allSettled(
    scrapers.map(async (scraper) => {
      try {
        const news = await runScraper(scraper);
        completed++;
        updateProgress(
          Math.round((completed / scrapers.length) * 100),
          `${scraper.siteName} tamamlandı (${completed}/${scrapers.length})`,
        );
        return { siteName: scraper.siteName, news };
      } catch (e) {
        completed++;
        const errMsg = `${scraper.siteName}: ${String(e)}`;
        console.error(`❌ ${errMsg}`);
        addError(errMsg);
        updateProgress(
          Math.round((completed / scrapers.length) * 100),
          `${scraper.siteName} hata (${completed}/${scrapers.length})`,
        );
        return { siteName: scraper.siteName, news: [] };
      }
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allNews.push(...result.value.news);
      addNews(result.value.news);
    }
  }

  allNews.sort(
    (a, b) =>
      new Date(b.parsed_date).getTime() - new Date(a.parsed_date).getTime(),
  );

  completeScraping();
}
