import type { Metadata } from 'next'
import type { ReactNode, ReactElement } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'TranscriptorAI - Indonesian Speech-to-Text',
  description: 'Zero-cost Indonesian speech transcription with AI correction',
}

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="id">
      <head>
        <link
          rel="preload"
          as="image"
          href="/hero-illustration.svg"
          fetchPriority="high"
          type="image/svg+xml"
        />
      </head>
      <body className="bg-white antialiased dark:bg-gray-900">{children}</body>
    </html>
  )
}
