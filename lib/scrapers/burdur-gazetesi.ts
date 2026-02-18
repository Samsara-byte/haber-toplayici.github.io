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

  extractNewsFromHtml(..._args: unknown[]): RawNewsItem[] {
    return [];
  }

  private extractNewsFromHtmlWithDate(
    htmlContent: string,
    dateObj: Date,
  ): NewsItem[] {
    const $ = this.load(htmlContent);
    const newsList: NewsItem[] = [];

    $("div.f-hit li").each((_, item) => {
      const news = this.parseHitItem($, item, new Date(dateObj));
      if (news) newsList.push(news);
    });

    $("div.f-cat").each((_, catSection) => {
      const category = $(catSection).find("h3").text().trim() || "Genel";
      $(catSection)
        .find("li")
        .each((_, item) => {
          const news = this.parseListItem($, item, new Date(dateObj), category);
          if (news) newsList.push(news);
        });
    });

    return newsList;
  }

  private parseHitItem(
    $: ReturnType<typeof this.load>,
    item: ReturnType<typeof $>[0],
    dateObj: Date,
  ): NewsItem | null {
    try {
      const linkTag = $(item).find("a").first();
      if (!linkTag.length) return null;
      const href = linkTag.attr("href") || "";
      if (!href) return null;
      const title = linkTag.find("h2").text().trim();
      if (!title || title.length < 10) return null;
      const fullLink = href.startsWith("/")
        ? `${this.siteConfig.base_url}${href}`
        : href;

      const timeMatch = linkTag
        .find("time")
        .text()
        .trim()
        .match(/(\d{2}):(\d{2})/);
      if (timeMatch) dateObj.setHours(+timeMatch[1], +timeMatch[2], 0, 0);

      return this.formatNewsItem(title, fullLink, "", "Manşet", dateObj);
    } catch {
      return null;
    }
  }

  private parseListItem(
    $: ReturnType<typeof this.load>,
    item: ReturnType<typeof $>[0],
    dateObj: Date,
    category: string,
  ): NewsItem | null {
    try {
      const linkTag = $(item).find("a").first();
      if (!linkTag.length) return null;
      const href = linkTag.attr("href") || "";
      const title = linkTag.text().trim();
      if (!href || !title || title.length < 10) return null;
      const fullLink = href.startsWith("/")
        ? `${this.siteConfig.base_url}${href}`
        : href;

      const timeMatch = $(item)
        .find("time")
        .text()
        .trim()
        .match(/(\d{2}):(\d{2})/);
      if (timeMatch) dateObj.setHours(+timeMatch[1], +timeMatch[2], 0, 0);

      return this.formatNewsItem(title, fullLink, "", category, dateObj);
    } catch {
      return null;
    }
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
