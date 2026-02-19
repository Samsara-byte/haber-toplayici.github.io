export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  const {
    getScrapingState,
    resetScrapingState,
    addNews,
    addError,
    updateProgress,
    completeScraping,
    failScraping,
    setSiteStatus,
  } = await import("@/lib/scraping-state");
  const { getAllScrapers, runScraper } = await import("@/lib/scrapers");

  const state = getScrapingState();
  if (state.is_scraping) {
    return NextResponse.json({
      success: false,
      error: "Scraping zaten devam ediyor",
    });
  }

  const scrapers = getAllScrapers();
  resetScrapingState(scrapers.map((s) => s.siteName));

  const run = async () => {
    if (scrapers.length === 0) {
      addError("Aktif scraper bulunamadı");
      completeScraping();
      return;
    }

    let completed = 0;
    updateProgress(0, "Tüm siteler paralel taranıyor...");

    await Promise.allSettled(
      scrapers.map(async (scraper) => {
        setSiteStatus(scraper.siteName, "running");
        try {
          const news = await runScraper(scraper);
          completed++;
          addNews(news);
          setSiteStatus(scraper.siteName, "done", news.length);
          updateProgress(
            Math.round((completed / scrapers.length) * 100),
            `${scraper.siteName} tamamlandı (${completed}/${scrapers.length})`,
          );
        } catch (e) {
          completed++;
          addError(`${scraper.siteName}: ${String(e)}`);
          setSiteStatus(scraper.siteName, "error", 0);
          updateProgress(
            Math.round((completed / scrapers.length) * 100),
            `${scraper.siteName} hata aldı (${completed}/${scrapers.length})`,
          );
        }
      }),
    );
    completeScraping();
  };

  run().catch((err) => failScraping(String(err)));

  return NextResponse.json({ success: true, message: "Scraping başlatıldı" });
}
