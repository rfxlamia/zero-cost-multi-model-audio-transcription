import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TranscriptorAI - Indonesian Speech-to-Text',
  description: 'Zero-cost Indonesian speech transcription with AI correction',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className="antialiased bg-white dark:bg-gray-900">
        {children}
      </body>
    </html>
  )
}
