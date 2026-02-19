export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const { buildStatusResponse } = await import('@/lib/scraping-state')
  return NextResponse.json(buildStatusResponse())
}
