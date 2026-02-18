import { BaseScraper } from "./base-scraper";
import { Config } from "@/lib/config";
import { NewsItem, RawNewsItem } from "@/types";

export class NNCHaberScraper extends BaseScraper {
  constructor() {
    super(Config.SITES["nnc_haber"]);
  }

  get siteName(): string {
    return "NNC Haber";
  }

  async scrape(): Promise<NewsItem[]> {
    console.log(`📰 ${this.siteName} taranıyor...`);

    const response = await this.httpGet(this.siteConfig.base_url);
    if (!response) {
      console.log(`❌ ${this.siteName}: Sayfaya erişilemedi`);
      return [];
    }

    const allNewsRaw = this.extractNewsFromHtml(response.text);
    const finalNews = await this.fetchDatesParallel(allNewsRaw);
    finalNews.sort(
      (a, b) =>
        new Date(b.parsed_date).getTime() - new Date(a.parsed_date).getTime(),
    );
    console.log(`✅ ${this.siteName}: ${finalNews.length} haber`);
    return finalNews;
  }

  extractNewsFromHtml(htmlContent: string): RawNewsItem[] {
    const $ = this.load(htmlContent);
    const newsList: RawNewsItem[] = [];

    const carousel = $("div.owl-carousel");
    if (!carousel.length) return newsList;

    carousel.find("div.item").each((_, item) => {
      try {
        const onclick = $(item).attr("onclick") || "";
        const urlMatch = onclick.match(/window\.open\('([^']+)'/);
        if (!urlMatch) return;

        const href = urlMatch[1];
        const imgTag = $(item).find("img");
        if (!imgTag.length) return;

        const image = imgTag.attr("src") || "";
        const title = imgTag.attr("alt")?.trim() || "";
        if (!href || !title || title.length < 10) return;

        const fullLink = href.startsWith("/")
          ? `${this.siteConfig.base_url}${href}`
          : href;
        const category = this.extractCategoryFromUrl(href);

        newsList.push({ title, link: fullLink, image, category });
      } catch {
        /* skip */
      }
    });

    return newsList;
  }

  async fetchNewsDate(url: string): Promise<Date | null> {
    const response = await this.httpGet(url, { timeout: 5000 });
    if (!response) return null;

    const $ = this.load(response.text);
    const blogInfo = $("ul.blog-info-link");
    if (!blogInfo.length) return null;

    try {
      let dateText = "";
      let timeText = "";

      blogInfo.find("li").each((_, li) => {
        const linkHtml = $(li).html() || "";
        const text = $(li).find("a").text().trim();

        if (linkHtml.includes("fa-calendar")) {
          const m = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
          if (m) dateText = m[0];
        } else if (linkHtml.includes("fa-clock")) {
          const m = text.match(/(\d{2})\.(\d{2})/);
          if (m) timeText = m[0];
        }
      });

      if (dateText) {
        const [day, month, year] = dateText.split(".").map(Number);
        if (timeText) {
          const [hour, minute] = timeText.split(".").map(Number);
          return new Date(year, month - 1, day, hour, minute);
        }
        return new Date(year, month - 1, day);
      }
    } catch {
      /* ignore */
    }

    return null;
  }

  private extractCategoryFromUrl(url: string): string {
    const match = url.match(/\/([^/]+)\//);
    if (!match) return "Genel";

    const categoryMap: Record<string, string> = {
      gundem: "Gündem",
      spor: "Spor",
      ekonomi: "Ekonomi",
      magazin: "Magazin",
      saglik: "Sağlık",
      egitim: "Eğitim",
      teknoloji: "Teknoloji",
      kultur: "Kültür",
      sanat: "Sanat",
      yerel: "Yerel",
      dunya: "Dünya",
      turkiye: "Türkiye",
    };

    const key = match[1].toLowerCase();
    return (
      categoryMap[key] || match[1].charAt(0).toUpperCase() + match[1].slice(1)
    );
  }
}
