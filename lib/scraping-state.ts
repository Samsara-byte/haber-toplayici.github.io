import { NewsItem, ScrapingState, SiteProgress } from '@/types'

declare global {
  // eslint-disable-next-line no-var
  var __scrapingState: ScrapingState | undefined
  // eslint-disable-next-line no-var
  var __siteProgresses: SiteProgress[] | undefined
}

if (!global.__scrapingState) {
  global.__scrapingState = {
    is_scraping: false,
    progress: 0,
    current_site: '',
    news: [],
    errors: [],
    completed: false,
  }
}

if (!global.__siteProgresses) {
  global.__siteProgresses = []
}

export function getScrapingState(): ScrapingState {
  return global.__scrapingState!
}

export function getSiteProgresses(): SiteProgress[] {
  return global.__siteProgresses!
}

export function resetScrapingState(siteNames: string[]): void {
  global.__scrapingState = {
    is_scraping: true,
    progress: 0,
    current_site: '',
    news: [],
    errors: [],
    completed: false,
  }
  global.__siteProgresses = siteNames.map((name) => ({
    name,
    status: 'waiting',
    count: 0,
  }))
}

export function updateProgress(progress: number, currentSite: string): void {
  if (!global.__scrapingState) return
  global.__scrapingState.progress = progress
  global.__scrapingState.current_site = currentSite
}

export function setSiteStatus(
  name: string,
  status: SiteProgress['status'],
  count?: number
): void {
  if (!global.__siteProgresses) return
  const site = global.__siteProgresses.find((s) => s.name === name)
  if (site) {
    site.status = status
    if (count !== undefined) site.count = count
  }
}

export function addNews(newItems: NewsItem[]): void {
  if (!global.__scrapingState) return
  global.__scrapingState.news.push(...newItems)
}

export function addError(error: string): void {
  if (!global.__scrapingState) return
  global.__scrapingState.errors.push(error)
}

export function completeScraping(): void {
  if (!global.__scrapingState) return
  global.__scrapingState.progress = 100
  global.__scrapingState.current_site = 'Tamamlandı'
  global.__scrapingState.completed = true
  global.__scrapingState.is_scraping = false
}

export function failScraping(error: string): void {
  if (!global.__scrapingState) return
  global.__scrapingState.errors.push(error)
  global.__scrapingState.completed = true
  global.__scrapingState.is_scraping = false
}

export function buildStatusResponse() {
  const state = getScrapingState()
  const todayNews = state.news.filter((n) => n.is_today)
  const yesterdayNews = state.news.filter((n) => !n.is_today)

  return {
    is_scraping: state.is_scraping,
    progress: state.progress,
    current_site: state.current_site,
    total: state.news.length,
    today_count: todayNews.length,
    yesterday_count: yesterdayNews.length,
    today_news: todayNews,
    yesterday_news: yesterdayNews,
    errors: state.errors,
    completed: state.completed,
    site_progresses: getSiteProgresses(),
  }
}
