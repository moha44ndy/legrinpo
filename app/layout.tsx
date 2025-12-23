import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Plateforme de Discussion - Groupe Politique',
  description: 'Plateforme de discussion et de coordination en temps réel pour votre groupe politique',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}

