export interface NewsItem {
  title: string;
  link: string;
  image: string;
  category: string;
  date: string;
  time: string;
  is_today: boolean;
  parsed_date: string;
  source: string;
  source_id: string;
}

export interface SiteConfig {
  name: string;
  enabled: boolean;
  category: "local" | "national";
  base_url: string;
  list_url: string;
  ajax_url?: string;
  color: string;
}

export interface SiteInfo {
  id: string;
  name: string;
  enabled: boolean;
  base_url: string;
  color: string;
  category: string;
}

export interface ScrapingState {
  is_scraping: boolean;
  progress: number;
  current_site: string;
  news: NewsItem[];
  errors: string[];
  completed: boolean;
}

export interface SiteProgress {
  name: string;
  status: "waiting" | "running" | "done" | "error";
  count: number;
}

export interface ScrapingStatusResponse {
  is_scraping: boolean;
  progress: number;
  current_site: string;
  total: number;
  today_count: number;
  yesterday_count: number;
  today_news: NewsItem[];
  yesterday_news: NewsItem[];
  errors: string[];
  completed: boolean;
  site_progresses?: SiteProgress[];
}

export interface RawNewsItem {
  title: string;
  link: string;
  image: string;
  category: string;
}
