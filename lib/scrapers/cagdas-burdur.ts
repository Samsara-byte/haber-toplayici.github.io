import { BaseScraper } from "./base-scraper";
import { Config } from "@/lib/config";
import { NewsItem, RawNewsItem } from "@/types";

export class CagdasBurdurScraper extends BaseScraper {
  constructor() {
    super(Config.SITES["cagdas_burdur"]);
  }

  get siteName(): string {
    return "Çağdaş Burdur";
  }

  async scrape(): Promise<NewsItem[]> {
    console.log(`📰 ${this.siteName} taranıyor...`);

    const response = await this.httpGet(this.siteConfig.base_url);
    if (!response) {
      console.log(`❌ ${this.siteName}: Sayfaya erişilemedi`);
      return [];
    }

    const allNews = await this.extractNewsWithEarlyStop(response.text);
    allNews.sort(
      (a, b) =>
        new Date(b.parsed_date).getTime() - new Date(a.parsed_date).getTime(),
    );
    console.log(`✅ ${this.siteName}: ${allNews.length} haber`);
    return allNews;
  }

  extractNewsFromHtml(_htmlContent: string): RawNewsItem[] {
    return [];
  }

  private async extractNewsWithEarlyStop(
    htmlContent: string,
  ): Promise<NewsItem[]> {
    const $ = this.load(htmlContent);
    const newsList: NewsItem[] = [];

    const slider = $("ul.bxslider");
    if (!slider.length) return newsList;

    const sliderItems = slider.find("li").toArray().slice(0, 50);
    console.log(`  📊 ${sliderItems.length} haber bulundu`);

    let consecutiveOld = 0;
    const MAX_CONSECUTIVE_OLD = 3;

    // Hız için: haberleri batch'ler halinde paralel işle
    const batchSize = Config.MAX_WORKERS;
    const batches: typeof sliderItems = [];

    outer: for (let i = 0; i < sliderItems.length; i += batchSize) {
      if (consecutiveOld >= MAX_CONSECUTIVE_OLD) break;

      const batch = sliderItems.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const newsPost = $(item).find("div.news-post");
          if (!newsPost.length) return null;

          const linkTag = newsPost.find("a").first();
          if (!linkTag.length) return null;

          const href = linkTag.attr("href") || "";
          if (!href) return null;

          const fullLink = href.startsWith("http")
            ? href
            : `${this.siteConfig.base_url}${href}`;

          const imgTag = linkTag.find("img");
          let image = imgTag.attr("data-src") || imgTag.attr("src") || "";
          if (image && !image.startsWith("http")) {
            image = `${this.siteConfig.base_url}${image}`;
          }

          const title = imgTag.attr("alt")?.trim() || "";
          if (!title || title.length < 10) return null;

          const hoverBox = $(item).find("div.hover-box");
          let category = "Genel";
          if (hoverBox.length) {
            const catTag = hoverBox.find("a.category-post");
            if (catTag.length) category = catTag.text().trim();
          }

          const newsDate = await this.fetchNewsDate(fullLink);
          if (!newsDate) return null;

          if (this.isRecentNews(newsDate)) {
            return {
              news: this.formatNewsItem(
                title,
                fullLink,
                image,
                category,
                newsDate,
              ),
              isOld: false,
            };
          }
          return { news: null, isOld: true };
        }),
      );

      for (const result of results) {
        if (consecutiveOld >= MAX_CONSECUTIVE_OLD) break outer;

        if (result.status === "fulfilled" && result.value?.news) {
          newsList.push(result.value.news);
          consecutiveOld = 0;
        } else if (result.status === "fulfilled" && result.value?.isOld) {
          consecutiveOld++;
        } else {
          consecutiveOld++;
        }
      }
    }

    return newsList;
  }

  async fetchNewsDate(url: string): Promise<Date | null> {
    const response = await this.httpGet(url, { timeout: 5000 });
    if (!response) return null;

    const $ = this.load(response.text);

    // 1. post-tags (Yayın Tarihi: DD Ay YYYY HH:MM)
    const postTags = $("ul.post-tags");
    if (postTags.length) {
      const match = postTags
        .text()
        .match(/Yayın Tarihi:\s*(\d{1,2})\s+(\w+)\s+(\d{4})\s+(\d{2}):(\d{2})/);
      if (match) {
        const monthMap: Record<string, number> = {
          ocak: 1,
          şubat: 2,
          mart: 3,
          nisan: 4,
          mayıs: 5,
          haziran: 6,
          temmuz: 7,
          ağustos: 8,
          eylül: 9,
          ekim: 10,
          kasım: 11,
          aralık: 12,
        };
        const month = monthMap[match[2].toLowerCase()];
        if (month) {
          return new Date(
            +match[3],
            month - 1,
            +match[1],
            +match[4],
            +match[5],
          );
        }
      }
    }

    // 2. meta tag
    const metaDate = this.parseDateFromMeta(response.text);
    if (metaDate) return metaDate;

    // 3. DD.MM.YYYY HH:MM pattern
    const parsed = this.parseTurkishDate($.root().text().slice(0, 2000));
    if (parsed) return parsed;

    return new Date();
  }
}
