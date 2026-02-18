import axios, { AxiosInstance } from 'axios'
import * as cheerio from 'cheerio'
import { Config } from '@/lib/config'
import { NewsItem, RawNewsItem, SiteConfig } from '@/types'

export abstract class BaseScraper {
  protected siteConfig: SiteConfig
  protected httpClient: AxiosInstance
  protected today: Date
  protected yesterday: Date

  constructor(siteConfig: SiteConfig) {
    this.siteConfig = siteConfig
    this.today = new Date()
    this.yesterday = new Date(this.today)
    this.yesterday.setDate(this.yesterday.getDate() - 1)

    this.httpClient = axios.create({
      timeout: Config.REQUEST_TIMEOUT,
      headers: {
        'User-Agent': Config.USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
        Connection: 'keep-alive',
      },
    })
  }

  abstract get siteName(): string
  abstract scrape(): Promise<NewsItem[]>
  abstract extractNewsFromHtml(htmlContent: string, ...args: unknown[]): RawNewsItem[]
  abstract fetchNewsDate(url: string): Promise<Date | null>

  protected isRecentNews(newsDate: Date, days?: number): boolean {
    const rangeDays = days ?? Config.DATE_RANGE_DAYS
    const diff = Math.floor(
      (Date.UTC(this.today.getFullYear(), this.today.getMonth(), this.today.getDate()) -
        Date.UTC(newsDate.getFullYear(), newsDate.getMonth(), newsDate.getDate())) /
        86400000
    )
    return diff >= 0 && diff <= rangeDays
  }

  protected formatNewsItem(
    title: string,
    link: string,
    image: string,
    category: string,
    newsDate: Date
  ): NewsItem {
    return {
      title,
      link,
      image,
      category,
      date: this.formatDate(newsDate),
      time: this.formatTime(newsDate),
      is_today: this.isSameDay(newsDate, this.today),
      parsed_date: newsDate.toISOString(),
      source: this.siteName,
      source_id: this.getSiteId(),
    }
  }

  protected getSiteId(): string {
    for (const [siteId, cfg] of Object.entries(Config.SITES)) {
      if (cfg.name === this.siteName) return siteId
    }
    return 'unknown'
  }

  protected formatDate(date: Date): string {
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  protected formatTime(date: Date): string {
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit', minute: '2-digit',
    })
  }

  protected isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }

  protected async httpGet(
    url: string,
    options?: {
      params?: Record<string, unknown>
      headers?: Record<string, string>
      timeout?: number
    }
  ): Promise<{ text: string; json: () => unknown; status: number } | null> {
    try {
      const res = await this.httpClient.get(url, {
        params: options?.params,
        headers: options?.headers,
        timeout: options?.timeout ?? Config.REQUEST_TIMEOUT,
      })
      return {
        text: res.data as string,
        json: () => res.data,
        status: res.status,
      }
    } catch {
      return null
    }
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
protected load(html: string): any {
  return cheerio.load(html)
}
  // ============================================================
  // PARALEL TARİH ÇEKME - EARLY STOPPING İLE (Hız optimizasyonu)
  // Haberler batch'ler halinde paralel işlenir.
  // Arka arkaya 3 eski haber bulununca durur → gereksiz istek yok.
  // ============================================================
  protected async fetchDatesParallelWithEarlyStop(
    newsList: RawNewsItem[]
  ): Promise<NewsItem[]> {
    const finalNews: NewsItem[] = []
    const MAX_CONSECUTIVE_OLD = 3
    let consecutiveOld = 0
    let processedCount = 0

    // Haberleri MAX_WORKERS büyüklüğünde batch'lere böl
    const batchSize = Config.MAX_WORKERS
    const batches: RawNewsItem[][] = []
    for (let i = 0; i < newsList.length; i += batchSize) {
      batches.push(newsList.slice(i, i + batchSize))
    }

    outer: for (const batch of batches) {
      if (consecutiveOld >= MAX_CONSECUTIVE_OLD) break

      // Batch içindeki tüm istekleri aynı anda at → paralel
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const newsDate = await this.fetchNewsDate(item.link)
          if (!newsDate) return { news: null, isRecent: false, date: null }
          const isRecent = this.isRecentNews(newsDate)
          return {
            news: isRecent
              ? this.formatNewsItem(item.title, item.link, item.image, item.category, newsDate)
              : null,
            isRecent,
            date: newsDate,
          }
        })
      )

      for (const result of results) {
        processedCount++
        if (consecutiveOld >= MAX_CONSECUTIVE_OLD) break outer

        if (result.status === 'fulfilled' && result.value.news) {
          finalNews.push(result.value.news)
          consecutiveOld = 0
        } else if (result.status === 'fulfilled' && result.value.date) {
          consecutiveOld++
        } else {
          consecutiveOld++
        }
      }
    }

    const skipped = newsList.length - processedCount
    if (skipped > 0) {
      console.log(
        `⚡ Optimizasyon: ${skipped} haber atlandı (%${Math.round((skipped / newsList.length) * 100)} hız artışı)`
      )
    }

    return finalNews
  }

  // Early stopping olmadan paralel çekme
  protected async fetchDatesParallel(newsList: RawNewsItem[]): Promise<NewsItem[]> {
    const finalNews: NewsItem[] = []
    const batchSize = Config.MAX_WORKERS
    const batches: RawNewsItem[][] = []

    for (let i = 0; i < newsList.length; i += batchSize) {
      batches.push(newsList.slice(i, i + batchSize))
    }

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const newsDate = await this.fetchNewsDate(item.link)
          if (!newsDate || !this.isRecentNews(newsDate)) return null
          return this.formatNewsItem(item.title, item.link, item.image, item.category, newsDate)
        })
      )
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          finalNews.push(result.value)
        }
      }
    }

    return finalNews
  }

  protected parseDateFromMeta(html: string): Date | null {
    const $ = this.load(html)
    const metaTag =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="publish_date"]').attr('content') ||
      $('meta[itemprop="datePublished"]').attr('content')

    if (metaTag) {
      try {
        const clean = metaTag.replace('Z', '').replace(/\+\d{2}:\d{2}$/, '')
        return new Date(clean)
      } catch { /* ignore */ }
    }

    const timeAttr = $('time').attr('datetime')
    if (timeAttr) {
      try {
        const clean = timeAttr.replace('Z', '').replace(/\+\d{2}:\d{2}$/, '')
        return new Date(clean)
      } catch { /* ignore */ }
    }

    return null
  }

  protected parseTurkishDate(text: string): Date | null {
    // DD.MM.YYYY - HH:MM
    const match = text.match(/(\d{2})\.(\d{2})\.(\d{4})\s*[-–]\s*(\d{2}):(\d{2})/)
    if (match) {
      return new Date(+match[3], +match[2] - 1, +match[1], +match[4], +match[5])
    }
    // DD.MM.YYYY HH:MM
    const match2 = text.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/)
    if (match2) {
      return new Date(+match2[3], +match2[2] - 1, +match2[1], +match2[4], +match2[5])
    }
    // DD.MM.YYYY
    const match3 = text.match(/(\d{2})\.(\d{2})\.(\d{4})/)
    if (match3) {
      return new Date(+match3[3], +match3[2] - 1, +match3[1])
    }
    return null
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
