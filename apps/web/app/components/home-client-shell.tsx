'use client'

import dynamic from 'next/dynamic'
import type { ReactElement } from 'react'

const HomeInteractive = dynamic(() => import('./home-interactive'), {
  ssr: false,
  loading: () => (
    <section className="mx-auto max-w-5xl animate-fade-in">
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-10 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-indigo-500" aria-hidden />
              Preparing recorder
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Memuat panel transkripsi
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Komponen rekam, unggah, dan streaming SSE sedang dimuat di browser Anda. Ini menjaga
              waktu muat awal tetap ringan dan responsif.
            </p>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 self-stretch">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-left shadow-sm dark:border-slate-700/70 dark:bg-slate-800"
              >
                <div className="h-2 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-5 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  ),
})

export default function HomeClientShell(): ReactElement {
  return <HomeInteractive />
}
