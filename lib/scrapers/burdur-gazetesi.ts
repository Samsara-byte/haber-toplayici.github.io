import { BaseScraper } from "./base-scraper";
import { Config } from "@/lib/config";
import { NewsItem, RawNewsItem } from "@/types";
import axios from "axios";

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

  private async fetchViaProxy(url: string): Promise<string | null> {
    // 1. allorigins.win proxy dene (ücretsiz, Cloudflare bypass)
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
      const res = await axios.get(proxyUrl, { timeout: 20000 })
      const data = res.data as { contents?: string }
      if (data?.contents && data.contents.length > 500) {
        console.log(`  ✅ allorigins proxy başarılı (${data.contents.length} karakter)`)
        return data.contents
      }
    } catch (e: unknown) {
      const err = e as { message?: string }
      console.log(`  ⚠️ allorigins hata: ${err.message}, direkt deneniyor...`)
    }

    // 2. corsproxy.io dene
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`
      const res = await axios.get(proxyUrl, {
        timeout: 20000,
        headers: { "User-Agent": Config.USER_AGENT },
      })
      if (res.data && String(res.data).length > 500) {
        console.log(`  ✅ corsproxy başarılı`)
        return res.data as string
      }
    } catch (e: unknown) {
      const err = e as { message?: string }
      console.log(`  ⚠️ corsproxy hata: ${err.message}`)
    }

    // 3. Direkt istek dene
    console.log(`  ⚠️ Proxy'ler başarısız, direkt istek deneniyor...`)
    const res = await this.httpGet(url)
    return res?.text || null
  }

  async scrapeWithDate(): Promise<NewsItem[]> {
    console.log(`📰 ${this.siteName} taranıyor...`);
    const allNews: NewsItem[] = [];

    const datesToScrape: [Date, string][] = [
      [new Date(this.today), "Bugün"],
      [new Date(this.yesterday), "Dün"],
    ];

    for (const [dateObj, dateLabel] of datesToScrape) {
      const dateStr = this.formatDateForUrl(dateObj);
      const archiveUrl = `${this.siteConfig.base_url}/arsiv/${dateStr}`;
      console.log(`  🔗 İstek atılıyor: ${archiveUrl}`);

      const html = await this.fetchViaProxy(archiveUrl)
      if (!html) {
        console.log(`  ❌ ${dateLabel}: tüm yöntemler başarısız`);
        continue;
      }

      console.log(`  📄 ${dateLabel}: HTML uzunluğu: ${html.length}`);

      const pageNews = this.extractNewsFromHtmlWithDate(html, dateObj);
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
    $("div.f-hit li").each((_i: number, item: unknown) => {
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

        newsList.push(this.formatNewsItem(title, fullLink, "", "Manşet", d));
      } catch { /* skip */ }
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
