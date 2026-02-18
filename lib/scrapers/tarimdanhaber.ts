import { BaseScraper } from "./base-scraper";
import { Config } from "@/lib/config";
import { NewsItem, RawNewsItem } from "@/types";

export class TarimdanHaberScraper extends BaseScraper {
  constructor() {
    super(Config.SITES["tarimdanhaber"]);
  }

  get siteName(): string {
    return "Tarımdan Haber";
  }

  async scrape(): Promise<NewsItem[]> {
    console.log(`📰 ${this.siteName} taranıyor...`);

    const response = await this.httpGet(this.siteConfig.list_url);
    if (!response) {
      console.log(`❌ ${this.siteName}: Sayfaya erişilemedi`);
      return [];
    }

    const allNewsRaw = this.extractNewsFromHtml(response.text);
    const finalNews = await this.fetchDatesParallelWithEarlyStop(allNewsRaw);
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

    $("div.swiper-slide").each((_, slide) => {
      try {
        const dataLink = $(slide).attr("data-link") || "";
        const href = dataLink || $(slide).find("a").attr("href") || "";
        if (!href || href.length < 5) return;

        const fullLink = href.startsWith("/")
          ? `${this.siteConfig.base_url}${href}`
          : href;

        let titleTag = $(slide).find("h3.title-2-line");
        if (!titleTag.length) titleTag = $(slide).find("h3");
        if (!titleTag.length) return;

        const title = titleTag.text().trim();
        if (!title || title.length < 10) return;

        let imgTag = $(slide).find("img.img-fluid");
        if (!imgTag.length) imgTag = $(slide).find("img");
        const image = imgTag.attr("src") || "";

        const category =
          $(slide).find("span.mh-category").text().trim() || "Genel";

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

    // 1. <time> tag
    const timeTag = $("time");
    if (timeTag.length) {
      const datetimeAttr = timeTag.attr("datetime");
      if (datetimeAttr) {
        try {
          const clean = datetimeAttr
            .replace("Z", "")
            .replace(/\+\d{2}:\d{2}$/, "");
          const d = new Date(clean);
          if (!isNaN(d.getTime())) return d;
        } catch {
          /* ignore */
        }
      }
      const parsed = this.parseDateText(timeTag.text().trim());
      if (parsed) return parsed;
    }

    // 2. meta tag
    const metaDate = this.parseDateFromMeta(response.text);
    if (metaDate) return metaDate;

    // 3. JSON-LD
    const jsonldDate = this.parseDateFromJsonLd($);
    if (jsonldDate) return jsonldDate;

    // 4. Sayfa metninde ara
    return this.parseDateText($.root().text().slice(0, 1000));
  }

  private parseDateFromJsonLd($: ReturnType<typeof this.load>): Date | null {
    let result: Date | null = null;

    $('script[type="application/ld+json"]').each((_, script) => {
      if (result) return;
      try {
        const data = JSON.parse($(script).html() || "{}");
        let dateStr: string | null = null;

        if (data.datePublished) {
          dateStr = data.datePublished;
        } else if (data["@graph"]) {
          for (const item of data["@graph"]) {
            if (item.datePublished) {
              dateStr = item.datePublished;
              break;
            }
          }
        }

        if (dateStr) {
          const clean = dateStr.replace("Z", "").replace(/\+\d{2}:\d{2}$/, "");
          const d = new Date(clean);
          if (!isNaN(d.getTime())) result = d;
        }
      } catch {
        /* ignore */
      }
    });

    return result;
  }

  private parseDateText(text: string): Date | null {
    if (!text) return null;

    // DD.MM.YYYY - HH:MM
    const m1 = text.match(
      /(\d{1,2})\.(\d{1,2})\.(\d{4})[\s\-–]*(\d{1,2}):(\d{2})/,
    );
    if (m1) {
      const d = new Date(+m1[3], +m1[2] - 1, +m1[1], +m1[4], +m1[5]);
      if (!isNaN(d.getTime())) return d;
    }

    // DD.MM.YYYY
    const m2 = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m2) {
      const d = new Date(+m2[3], +m2[2] - 1, +m2[1]);
      if (!isNaN(d.getTime())) return d;
    }

    // Türkçe ay isimleri
    const ayMap: Record<string, number> = {
      ocak: 1,
      şubat: 2,
      mart: 3,
      nisan: 4,
      mayıs: 5,
      mayis: 5,
      haziran: 6,
      temmuz: 7,
      ağustos: 8,
      agustos: 8,
      eylül: 9,
      eylul: 9,
      ekim: 10,
      kasım: 11,
      kasim: 11,
      aralık: 12,
      aralik: 12,
    };

    const lower = text.toLowerCase();
    for (const [ayName, ayNum] of Object.entries(ayMap)) {
      if (!lower.includes(ayName)) continue;

      const m3 = lower.match(
        /(\d{1,2})\s+\w+\s+(\d{4})[\s\-–]+(\d{1,2}):(\d{2})/,
      );
      if (m3) {
        const d = new Date(+m3[2], ayNum - 1, +m3[1], +m3[3], +m3[4]);
        if (!isNaN(d.getTime())) return d;
      }

      const m4 = lower.match(/(\d{1,2})\s+\w+\s+(\d{4})/);
      if (m4) {
        const d = new Date(+m4[2], ayNum - 1, +m4[1]);
        if (!isNaN(d.getTime())) return d;
      }
    }

    return null;
  }
}
