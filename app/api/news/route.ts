export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { getAllScrapers, runScraper } = await import('@/lib/scrapers')
    const scrapers = getAllScrapers()
    const results = await Promise.allSettled(scrapers.map((s) => runScraper(s)))
    const allNews = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r as PromiseFulfilledResult<typeof allNews>).value)
    allNews.sort((a, b) => new Date(b.parsed_date).getTime() - new Date(a.parsed_date).getTime())
    return NextResponse.json({ success: true, count: allNews.length, news: allNews })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
