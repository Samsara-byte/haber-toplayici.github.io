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

    for (const [dateObj, dateLabel] of datesToScrape) {
      const dateStr = this.formatDateForUrl(dateObj);
      const archiveUrl = `${this.siteConfig.base_url}/arsiv/${dateStr}`;
      console.log(`  📅 ${dateLabel} (${dateStr}) taranıyor...`);

      const response = await this.httpGet(archiveUrl);
      if (response) {
        const pageNews = this.extractNewsFromHtmlWithDate(
          response.text,
          dateObj,
        );
        allNews.push(...pageNews);
        console.log(`  ✅ ${dateLabel}: ${pageNews.length} haber`);
      }
    }

    allNews.sort(
      (a, b) =>
        new Date(b.parsed_date).getTime() - new Date(a.parsed_date).getTime(),
    );
    console.log(`✅ ${this.siteName}: ${allNews.length} haber`);
    return allNews;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extractNewsFromHtml(..._args: unknown[]): RawNewsItem[] {
    return [];
  }

  private extractNewsFromHtmlWithDate(
    htmlContent: string,
    dateObj: Date,
  ): NewsItem[] {
    const $ = this.load(htmlContent);
    const newsList: NewsItem[] = [];
    const seenLinks = new Set<string>();

    // 1. f-hit bölümü — a > h2 yapısı
    $("div.f-hit li").each((_: number, item: unknown) => {
      try {
        const linkTag = $(item as never)
          .find("a")
          .first();
        if (!linkTag.length) return;

        const href = linkTag.attr("href") || "";
        if (!href) return;

        const title = linkTag.find("h2").text().trim();
        if (!title || title.length < 10) return;

        const fullLink = href.startsWith("/")
          ? `${this.siteConfig.base_url}${href}`
          : href;

        if (seenLinks.has(fullLink)) return;
        seenLinks.add(fullLink);

        // Saat: span.e1 > time
        const timeText = linkTag
          .find("span.e1 time")
          .text()
          .trim()
          .replace("<s>:</s>", ":")
          .replace(/\s/g, "");
        const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
        const d = new Date(dateObj);
        if (timeMatch) d.setHours(+timeMatch[1], +timeMatch[2], 0, 0);

        newsList.push(this.formatNewsItem(title, fullLink, "", "Manşet", d));
      } catch {
        /* skip */
      }
    });

    // 2. f-cat bölümleri — time ve a ayrı elementler
    $("div.f-cat").each((_: number, catSection: unknown) => {
      const category =
        $(catSection as never)
          .find("h3")
          .text()
          .trim() || "Genel";

      $(catSection as never)
        .find("ul.list li")
        .each((_: number, item: unknown) => {
          try {
            const linkTag = $(item as never)
              .find("a")
              .first();
            if (!linkTag.length) return;

            const href = linkTag.attr("href") || "";
            const title = linkTag.text().trim();
            if (!href || !title || title.length < 10) return;

            const fullLink = href.startsWith("/")
              ? `${this.siteConfig.base_url}${href}`
              : href;

            if (seenLinks.has(fullLink)) return;
            seenLinks.add(fullLink);

            // Saat: li içindeki time elementi (a'nın dışında)
            const timeText = $(item as never)
              .find("time")
              .first()
              .text()
              .trim();
            const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
            const d = new Date(dateObj);
            if (timeMatch) d.setHours(+timeMatch[1], +timeMatch[2], 0, 0);

            newsList.push(
              this.formatNewsItem(title, fullLink, "", category, d),
            );
          } catch {
            /* skip */
          }
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
