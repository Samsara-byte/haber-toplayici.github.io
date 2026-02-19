import { BaseScraper } from "./base-scraper";
import { Config } from "@/lib/config";
import { NewsItem, RawNewsItem } from "@/types";

export class BurdurGazetesiScraper extends BaseScraper {
  constructor() {
    super(Config.SITES["burdur_gazetesi"]);
  }

  get siteName(): string {
    return "Burdur Gazetesi";
  }

  async scrape(): Promise<NewsItem[]> {
    return this.scrapeWithDate();
  }

  async scrapeWithDate(): Promise<NewsItem[]> {
    console.log(`📰 ${this.siteName} taranıyor...`);
    const allNews: NewsItem[] = [];

    const datesToScrape: [Date, string][] = [
      [new Date(this.today), "Bugün"],
      [new Date(this.yesterday), "Dün"],
    ];

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Referer": "https://www.burdurgazetesi.com/",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Cache-Control": "max-age=0",
    }

    for (const [dateObj, dateLabel] of datesToScrape) {
      const dateStr = this.formatDateForUrl(dateObj);
      const archiveUrl = `${this.siteConfig.base_url}/arsiv/${dateStr}`;
      console.log(`  🔗 İstek atılıyor: ${archiveUrl}`);

      // Önce ana sayfaya git (cookie almak için)
      await this.httpGet(this.siteConfig.base_url, { headers })
      await this.sleep(500)

      const response = await this.httpGet(archiveUrl, { headers });
      if (!response) {
        console.log(`  ❌ ${dateLabel}: HTTP isteği başarısız`);
        continue;
      }

      console.log(`  📄 ${dateLabel}: HTTP ${response.status}, HTML uzunluğu: ${response.text.length}`);

      const $ = this.load(response.text);
      const fHitCount = $("div.f-hit li").length;
      const fCatCount = $("div.f-cat").length;
      console.log(`  📊 f-hit li: ${fHitCount}, f-cat: ${fCatCount}`);

      const pageNews = this.extractNewsFromHtmlWithDate(response.text, dateObj);
      allNews.push(...pageNews);
      console.log(`  ✅ ${dateLabel}: ${pageNews.length} haber`);
    }

    allNews.sort(
      (a, b) =>
        new Date(b.parsed_date).getTime() - new Date(a.parsed_date).getTime()
    );
    console.log(`✅ ${this.siteName}: ${allNews.length} toplam haber`);
    return allNews;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extractNewsFromHtml(..._args: unknown[]): RawNewsItem[] {
    return [];
  }

  private extractNewsFromHtmlWithDate(htmlContent: string, dateObj: Date): NewsItem[] {
    const $ = this.load(htmlContent);
    const newsList: NewsItem[] = [];
    const seenLinks = new Set<string>();

    // 1. f-hit bölümü
    $("div.f-hit li").each((i: number, item: unknown) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const el = item as any;
        const linkTag = $(el).find("a").first();
        if (!linkTag.length) return;

        const href = linkTag.attr("href") || "";
        const title = linkTag.find("h2").text().trim();
        if (!title || title.length < 10) return;

        const fullLink = href.startsWith("/")
          ? `${this.siteConfig.base_url}${href}`
          : href;

        if (seenLinks.has(fullLink)) return;
        seenLinks.add(fullLink);

        const timeText = $(el).find("time").text().replace(/\s/g, "").trim();
        const timeMatch = timeText.match(/(\d{1,2})[:\s](\d{2})/);
        const d = new Date(dateObj);
        if (timeMatch) d.setHours(+timeMatch[1], +timeMatch[2], 0, 0);

        console.log(`    f-hit[${i}]: "${title.slice(0, 30)}"`);
        newsList.push(this.formatNewsItem(title, fullLink, "", "Manşet", d));
      } catch (e) {
        console.log(`    f-hit[${i}] hata:`, e);
      }
    });

    // 2. f-cat bölümleri
    $("div.f-cat").each((_ci: number, catSection: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catEl = catSection as any;
      const category = $(catEl).find("h3").text().trim() || "Genel";

      $(catEl).find("li").each((_i: number, item: unknown) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const el = item as any;
          const linkTag = $(el).find("a").first();
          if (!linkTag.length) return;

          const href = linkTag.attr("href") || "";
          const title = linkTag.text().trim();
          if (!href || !title || title.length < 10) return;

          const fullLink = href.startsWith("/")
            ? `${this.siteConfig.base_url}${href}`
            : href;

          if (seenLinks.has(fullLink)) return;
          seenLinks.add(fullLink);

          const timeText = $(el).find("time").text().replace(/\s/g, "").trim();
          const timeMatch = timeText.match(/(\d{1,2})[:\s](\d{2})/);
          const d = new Date(dateObj);
          if (timeMatch) d.setHours(+timeMatch[1], +timeMatch[2], 0, 0);

          newsList.push(this.formatNewsItem(title, fullLink, "", category, d));
        } catch { /* skip */ }
      });
    });

    return newsList;
  }

  async fetchNewsDate(): Promise<Date | null> {
    return null;
  }

  private formatDateForUrl(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}
