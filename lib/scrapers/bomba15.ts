import { BaseScraper } from './base-scraper'
import { Config } from '@/lib/config'
import { NewsItem, RawNewsItem } from '@/types'

export class Bomba15Scraper extends BaseScraper {
  private ajaxUrl: string

  constructor() {
    super(Config.SITES['bomba15'])
    this.ajaxUrl = Config.SITES['bomba15'].ajax_url!
  }

  get siteName(): string {
    return 'Bomba15'
  }

  async scrape(): Promise<NewsItem[]> {
    console.log(`📰 ${this.siteName} taranıyor...`)
    const allNewsRaw: RawNewsItem[] = []

    const response = await this.httpGet(this.siteConfig.list_url)
    if (response) {
      allNewsRaw.push(...this.extractNewsFromHtml(response.text))
    }

    for (let pageNum = 1; pageNum < Config.MAX_PAGES; pageNum++) {
      const offset = pageNum * Config.NEWS_PER_PAGE
      const ajaxHtml = await this.fetchAjaxNews(offset, Config.NEWS_PER_PAGE)
      if (ajaxHtml) {
        allNewsRaw.push(...this.extractNewsFromHtml(ajaxHtml))
        await this.sleep(Config.REQUEST_DELAY)
      } else {
        break
      }
    }

    const finalNews = await this.fetchDatesParallelWithEarlyStop(allNewsRaw)
    finalNews.sort((a, b) => new Date(b.parsed_date).getTime() - new Date(a.parsed_date).getTime())
    console.log(`✅ ${this.siteName}: ${finalNews.length} haber`)
    return finalNews
  }

  extractNewsFromHtml(htmlContent: string): RawNewsItem[] {
    const $ = this.load(htmlContent)
    const newsList: RawNewsItem[] = []

    $('div.col-6, div.col-lg-4').each((_, el) => {
      try {
        const card = $(el).find('div.card')
        if (!card.length) return
        const titleLink = card.find('h4 a')
        if (!titleLink.length) return
        const href = titleLink.attr('href') || ''
        const title = titleLink.text().trim()
        if (!href || !title || title.length < 10) return
        const fullLink = href.startsWith('/') ? `${this.siteConfig.base_url}${href}` : href
        const image = card.find('img').attr('src') || ''
        const category = card.find('a.fw-bold').text().trim() || 'Genel'
        newsList.push({ title, link: fullLink, image, category })
      } catch { /* skip */ }
    })

    return newsList
  }

  async fetchNewsDate(url: string): Promise<Date | null> {
    const response = await this.httpGet(url, { timeout: 5000 })
    if (!response) return null
    const $ = this.load(response.text)
    const timeText = $('time.fw-bold').text().trim()
    return timeText ? this.parseTurkishDate(timeText) : null
  }

  private async fetchAjaxNews(offset: number, limit: number): Promise<string | null> {
    const response = await this.httpGet(this.ajaxUrl, {
      params: {
        offset, limit, catid: '0',
        model: 'TE\\Blog\\Models\\Headlines',
        template: 'theme.flow::views.ajax-template.all-headline',
      },
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
    })
    if (!response || response.status !== 200) return null
    try {
      const data = response.json() as Record<string, unknown>
      const html = (data['data'] || data['html']) as string
      return html && html.length > 50 ? html : null
    } catch { return null }
  }
}
