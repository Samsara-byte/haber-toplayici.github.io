import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '📰 Haber Toplayıcı - Canlı',
  description: 'Tüm Haberler Tek Platformda',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
