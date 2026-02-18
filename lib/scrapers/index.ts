import { Config } from "@/lib/config";
import { BaseScraper } from "./base-scraper";
import { BurdurYeniGunScraper } from "./burdur-yenigun";
import { Bomba15Scraper } from "./bomba15";
import { BurdurGazetesiScraper } from "./burdur-gazetesi";
import { CagdasBurdurScraper } from "./cagdas-burdur";
import { NNCHaberScraper } from "./nnc-haber";
import { TarimdanHaberScraper } from "./tarimdanhaber";
import { NewsItem } from "@/types";

const AVAILABLE_SCRAPERS: Record<string, new () => BaseScraper> = {
  burdur_yenigun: BurdurYeniGunScraper,
  bomba15: Bomba15Scraper,
  burdur_gazetesi: BurdurGazetesiScraper,
  cagdas_burdur: CagdasBurdurScraper,
  nnc_haber: NNCHaberScraper,
  tarimdanhaber: TarimdanHaberScraper,
};

export function getScraper(siteId: string): BaseScraper {
  const ScraperClass = AVAILABLE_SCRAPERS[siteId];
  if (!ScraperClass) throw new Error(`Scraper bulunamadı: ${siteId}`);
  return new ScraperClass();
}

export function getAllScrapers(): BaseScraper[] {
  const scrapers: BaseScraper[] = [];
  for (const [siteId, siteConfig] of Object.entries(Config.SITES)) {
    if (!siteConfig.enabled) continue;
    try {
      scrapers.push(getScraper(siteId));
    } catch (e) {
      console.warn(`⚠️ Scraper yüklenemedi: ${siteId}`, e);
    }
  }
  return scrapers;
}

export async function runScraper(scraper: BaseScraper): Promise<NewsItem[]> {
  if (scraper instanceof BurdurGazetesiScraper) {
    return scraper.scrapeWithDate();
  }
  return scraper.scrape();
}

export {
  BurdurYeniGunScraper,
  Bomba15Scraper,
  BurdurGazetesiScraper,
  CagdasBurdurScraper,
  NNCHaberScraper,
  TarimdanHaberScraper,
  AVAILABLE_SCRAPERS,
};
