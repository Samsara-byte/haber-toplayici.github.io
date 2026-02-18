import { SiteConfig } from '@/types'

export const Config = {
  REQUEST_TIMEOUT: 15000,
  REQUEST_DELAY: 300,
  MAX_WORKERS: 10,
  MAX_PAGES: 6,
  NEWS_PER_PAGE: 12,
  DATE_RANGE_DAYS: 1,

  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  SITES: {
    burdur_yenigun: {
      name: 'Burdur Yeni Gün',
      enabled: true,
      category: 'local',
      base_url: 'https://www.burduryenigun.com',
      list_url: 'https://www.burduryenigun.com/tum-mansetler',
      ajax_url: 'https://www.burduryenigun.com/service/json/pagination.json',
      color: '#667eea',
    },
    bomba15: {
      name: 'Bomba15',
      enabled: true,
      category: 'local',
      base_url: 'https://www.bomba15.com',
      list_url: 'https://www.bomba15.com/tum-mansetler',
      ajax_url: 'https://www.bomba15.com/service/json/pagination.json',
      color: '#e74c3c',
    },
    burdur_gazetesi: {
      name: 'Burdur Gazetesi',
      enabled: true,
      category: 'local',
      base_url: 'https://www.burdurgazetesi.com',
      list_url: 'https://www.burdurgazetesi.com/arsiv',
      color: '#3498db',
    },
    cagdas_burdur: {
      name: 'Çağdaş Burdur',
      enabled: true,
      category: 'local',
      base_url: 'https://www.cagdasburdur.com',
      list_url: 'https://www.cagdasburdur.com',
      color: '#27ae60',
    },
    nnc_haber: {
      name: 'NNC Haber',
      enabled: true,
      category: 'local',
      base_url: 'https://www.nnchaber.com',
      list_url: 'https://www.nnchaber.com',
      color: '#e67e22',
    },
    tarimdanhaber: {
      name: 'Tarımdan Haber',
      enabled: true,
      category: 'national',
      base_url: 'https://www.tarimdanhaber.com',
      list_url: 'https://www.tarimdanhaber.com',
      color: '#2ecc71',
    },
  } as Record<string, SiteConfig>,

  getLocalSites(): Record<string, SiteConfig> {
    return Object.fromEntries(
      Object.entries(this.SITES).filter(
        ([, v]) => v.category === 'local' && v.enabled
      )
    )
  },

  getNationalSites(): Record<string, SiteConfig> {
    return Object.fromEntries(
      Object.entries(this.SITES).filter(
        ([, v]) => v.category === 'national' && v.enabled
      )
    )
  },
}
