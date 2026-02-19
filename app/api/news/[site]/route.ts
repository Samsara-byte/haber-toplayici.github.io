export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: { site: string } }
) {
  try {
    const { getScraper, runScraper } = await import('@/lib/scrapers')
    const scraper = getScraper(params.site)
    const news = await runScraper(scraper)
    return NextResponse.json({
      success: true,
      site: params.site,
      site_display_name: scraper.siteName,
      count: news.length,
      news,
    })
  } catch (e) {
    const isNotFound = String(e).includes('bulunamadı')
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: isNotFound ? 404 : 500 }
    )
  }
}
