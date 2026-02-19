'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { NewsItem, ScrapingStatusResponse, SiteProgress } from '@/types'

const LOCAL_SITE_NAMES = [
  'Burdur Yeni Gün', 'Bomba15', 'Burdur Gazetesi', 'Çağdaş Burdur', 'NNC Haber',
]

interface NewsData {
  local: NewsItem[]
  national: NewsItem[]
}

export default function HomePage() {
  const [isScraping, setIsScraping] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentSite, setCurrentSite] = useState('Başlatılıyor...')
  const [totalCount, setTotalCount] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [yesterdayCount, setYesterdayCount] = useState(0)
  const [localCount, setLocalCount] = useState(0)
  const [nationalCount, setNationalCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'local' | 'national'>('local')
  const [newsData, setNewsData] = useState<NewsData>({ local: [], national: [] })
  const [updateTime, setUpdateTime] = useState('')
  const [siteProgresses, setSiteProgresses] = useState<SiteProgress[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  const getUpdateTime = () =>
    new Date().toLocaleString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const handleStatusUpdate = useCallback((data: ScrapingStatusResponse) => {
    setProgress(data.progress)
    setCurrentSite(data.current_site || 'İşleniyor...')
    setTotalCount(data.total)
    setTodayCount(data.today_count)
    setYesterdayCount(data.yesterday_count)

    if (data.site_progresses) setSiteProgresses(data.site_progresses)

    const all = [...(data.today_news || []), ...(data.yesterday_news || [])]
    const local = all.filter((n) => LOCAL_SITE_NAMES.includes(n.source))
    const national = all.filter((n) => !LOCAL_SITE_NAMES.includes(n.source))
    setLocalCount(local.length)
    setNationalCount(national.length)
    setNewsData({ local, national })

    if (data.completed) {
      setIsScraping(false)
      setUpdateTime(getUpdateTime())
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  const pollStatus = useCallback(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/scraping-status')
        const data: ScrapingStatusResponse = await res.json()
        handleStatusUpdate(data)
        if (data.completed) clearInterval(interval)
      } catch { /* ignore */ }
    }, 1000)
  }, [handleStatusUpdate])

  const startScraping = useCallback(async () => {
    if (isScraping) return
    setIsScraping(true)
    setProgress(0)
    setSiteProgresses([])
    setCurrentSite('Başlatılıyor...')

    try {
      const res = await fetch('/api/start-scraping')
      const data = await res.json()

      if (!data.success) {
        setIsScraping(false)
        alert(data.error || 'Başlatılamadı')
        return
      }

      if (eventSourceRef.current) eventSourceRef.current.close()

      const es = new EventSource('/api/scraping-stream')
      eventSourceRef.current = es

      es.onmessage = (event) => {
        try {
          handleStatusUpdate(JSON.parse(event.data))
        } catch { /* ignore */ }
      }

      es.onerror = () => {
        es.close()
        eventSourceRef.current = null
        pollStatus()
      }
    } catch (e) {
      console.error('Başlatma hatası:', e)
      setIsScraping(false)
    }
  }, [isScraping, handleStatusUpdate, pollStatus])

  useEffect(() => {
    setUpdateTime(getUpdateTime())
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close()
    }
  }, [])

  const sourceCount = Object.keys(
    [...newsData.local, ...newsData.national].reduce<Record<string, boolean>>(
      (acc, n) => { acc[n.source] = true; return acc }, {}
    )
  ).length

  const renderNewsSection = (news: NewsItem[]) => {
    if (news.length === 0) return null
    const newsBySite: Record<string, NewsItem[]> = {}
    news.forEach((item) => {
      if (!newsBySite[item.source]) newsBySite[item.source] = []
      newsBySite[item.source].push(item)
    })

    return Object.entries(newsBySite).map(([siteName, siteNews]) => (
      <div key={siteName} className="site-section fade-in">
        <div className="glass-card site-header">
          <div className="site-info">
            <div className="site-logo">{siteName.charAt(0)}</div>
            <div className="site-details">
              <h2 className="site-title">{siteName}</h2>
              <span className="site-count">{siteNews.length} haber yüklendi</span>
            </div>
          </div>
          <div className="site-stats-mini">
            <span className="mini-stat today">
              <CalendarIcon /> {siteNews.filter((n) => n.is_today).length}
            </span>
            <span className="mini-stat yesterday">
              <CalendarIcon /> {siteNews.filter((n) => !n.is_today).length}
            </span>
          </div>
        </div>

        <div className="news-grid">
          {siteNews.map((item, i) => (
            <div
              key={`${item.link}-${i}`}
              className="glass-card news-card"
              onClick={() => window.open(item.link, '_blank')}
            >
              {item.image && (
                <div className="news-image-wrapper">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.title}
                    className="news-image"
                    loading="lazy"
                    onError={(e) => {
                      const w = (e.target as HTMLElement).parentElement
                      if (w) w.style.display = 'none'
                    }}
                  />
                  <div className="image-gradient" />
                  <div className={`news-badge ${item.is_today ? 'today-badge' : 'yesterday-badge'}`}>
                    {item.is_today ? 'BUGÜN' : 'DÜN'}
                  </div>
                </div>
              )}
              <div className="news-body">
                <div className="news-tags">
                  <span className="tag category-tag">{item.category || 'Genel'}</span>
                </div>
                <h3 className="news-title">{item.title}</h3>
                <div className="news-meta">
                  <span className="meta-item"><ClockIcon /> {item.time || '00:00'}</span>
                  <span className="meta-item"><DateIcon /> {item.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))
  }

  const statusColor = (status: string) => {
    if (status === 'done') return { bg: 'rgba(46,204,113,0.2)', border: 'rgba(46,204,113,0.4)' }
    if (status === 'running') return { bg: 'rgba(102,126,234,0.2)', border: 'rgba(102,126,234,0.4)' }
    if (status === 'error') return { bg: 'rgba(231,76,60,0.2)', border: 'rgba(231,76,60,0.4)' }
    return { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' }
  }

  const statusIcon = (status: string) => {
    if (status === 'waiting') return '⏳'
    if (status === 'running') return '🔄'
    if (status === 'done') return '✅'
    if (status === 'error') return '❌'
    return '⏳'
  }

  const statusLabel = (site: SiteProgress) => {
    if (site.status === 'waiting') return 'Bekliyor'
    if (site.status === 'running') return 'Taranıyor...'
    if (site.status === 'done') return `${site.count} haber`
    if (site.status === 'error') return 'Hata'
    return ''
  }

  return (
    <>
      <div className="bg-animation">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      {/* Progress Overlay */}
      <div className={`progress-overlay ${isScraping ? 'active' : ''}`}>
        <div className="progress-content-wrapper">
          <div className="progress-site-info">
            <div className="spinner-wrapper"><div className="loading-spinner" /></div>
            <h3>{currentSite}</h3>
          </div>

          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-stats">
            <span>%{progress}</span>
            <span>{totalCount} haber bulundu</span>
          </div>

          {/* Site bazlı durum listesi */}
          {siteProgresses.length > 0 && (
            <div style={{
              marginTop: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              maxHeight: '220px',
              overflowY: 'auto',
            }}>
              {siteProgresses.map((site) => {
                const colors = statusColor(site.status)
                return (
                  <div key={site.name} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    fontSize: '0.85rem',
                    transition: 'all 0.3s ease',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {statusIcon(site.status)} {site.name}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                      {statusLabel(site)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="container">
        {/* HEADER */}
        <div className="glass-card header">
          <div className="header-top">
            <div className="brand">
              <div className="brand-icon">📰</div>
              <div className="brand-text">
                <h1>Haber Toplayıcı</h1>
                <p className="subtitle">Tüm Haberler Tek Platformda</p>
              </div>
            </div>
            <button className="glass-btn primary-btn" onClick={startScraping} disabled={isScraping}>
              {isScraping ? <div className="btn-spinner" /> : <RefreshIcon />}
              <span>{isScraping ? 'Yükleniyor...' : 'Haberleri Yükle'}</span>
            </button>
          </div>

          <div className="stats-container">
            {[
              { icon: '📊', count: totalCount, label: 'Toplam Haber' },
              { icon: '📅', count: todayCount, label: 'Bugün' },
              { icon: '📆', count: yesterdayCount, label: 'Dün' },
              { icon: '🌐', count: sourceCount, label: 'Kaynak' },
            ].map(({ icon, count, label }) => (
              <div key={label} className="glass-stat">
                <div className="stat-icon">{icon}</div>
                <div className="stat-content">
                  <span className="stat-number">{count}</span>
                  <span className="stat-label">{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TABS */}
        <div className="glass-card tabs-container">
          <div className="tabs-nav">
            <button
              className={`tab-btn ${activeTab === 'local' ? 'active' : ''}`}
              onClick={() => setActiveTab('local')}
            >
              <LocationIcon /> <span>Yerel Haberler</span>
              <span className="tab-count">{localCount}</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'national' ? 'active' : ''}`}
              onClick={() => setActiveTab('national')}
            >
              <GlobeIcon /> <span>Ulusal Siteler</span>
              <span className="tab-count">{nationalCount}</span>
            </button>
          </div>

          <div className={`tab-content ${activeTab === 'local' ? 'active' : ''}`}>
            {newsData.local.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><LocationIcon size={80} /></div>
                <h3>Yerel Haberler Bekleniyor</h3>
                <p>Burdur bölgesi haber kaynaklarından güncel haberler yüklenmeyi bekliyor.</p>
              </div>
            ) : renderNewsSection(newsData.local)}
          </div>

          <div className={`tab-content ${activeTab === 'national' ? 'active' : ''}`}>
            {newsData.national.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><GlobeIcon size={80} /></div>
                <h3>Ulusal Haberler Bekleniyor</h3>
                <p>Ulusal haber sitelerinden güncel haberler yüklenmeyi bekliyor.</p>
              </div>
            ) : renderNewsSection(newsData.national)}
          </div>
        </div>

        {/* FOOTER */}
        <div className="footer">
          <div className="glass-card footer-content">
            <div className="footer-left">
              <p className="footer-brand">Haber Toplayıcı v2.0</p>
              <p className="footer-desc">Canlı Güncelleme Sistemi</p>
            </div>
            <div className="footer-right">
              <p className="footer-time">
                <ClockSmallIcon /> Son güncelleme: <span>{updateTime}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  )
}
function LocationIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}
function GlobeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="white" strokeWidth="2" />
      <line x1="8" y1="2" x2="8" y2="6" stroke="white" strokeWidth="2" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="white" strokeWidth="2" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z" />
      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
    </svg>
  )
}
function DateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z" />
    </svg>
  )
}
function ClockSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
