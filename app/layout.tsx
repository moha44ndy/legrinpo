import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { SyncRegistration } from '@/components/SyncRegistration'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#1a237e',
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  title: 'Legrinpo - Discussions',
  description: 'Plateforme de discussion et de coordination en temps réel - Legrinpo',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/favicon.svg', apple: '/icons/favicon.svg' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Legrinpo',
  },
  formatDetection: {
    telephone: false,
    email: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://www.highperformanceformat.com" />
        <link rel="preconnect" href="https://pl28769355.effectivegatecpm.com" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Google AdSense */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7440739960679215"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <AuthProvider>
          <SyncRegistration />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}