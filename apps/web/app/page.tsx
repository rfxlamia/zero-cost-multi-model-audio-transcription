import Image from 'next/image'
import type { ReactElement } from 'react'
import HomeClientShell from './components/home-client-shell'

const FEATURES = [
  {
    title: 'Rekam instan',
    description: 'Recorder browser-first dengan fallback otomatis ke worker',
    icon: '🎙️',
  },
  {
    title: 'Upload fleksibel',
    description: 'Validasi ukuran & durasi, langsung transkrip di edge',
    icon: '📁',
  },
  {
    title: 'Streaming progresif',
    description: 'SSE untuk raw → quick → enhanced dalam satu viewport',
    icon: '📡',
  },
] as const

function HeroSection(): ReactElement {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-8 py-16 text-slate-100 shadow-xl shadow-slate-950/20 dark:border-slate-800">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.25),transparent_55%)]" />
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-4 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            Saatnya transkripsi ngebut
          </div>
          <div className="space-y-6">
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
              TranscriptorAI — transkripsi Bahasa Indonesia dengan koreksi progresif real-time
            </h1>
            <p className="max-w-xl text-lg text-slate-300">
              TranscriptorAI menggabungkan beberapa provider ASR dan Transformers.js secara adaptif
              untuk menghadirkan teks yang akurat, dengan fokus pada performa dan insight streaming
              SSE yang transparan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="#panel-transkripsi"
              className="inline-flex items-center gap-3 rounded-full bg-emerald-500 px-6 py-3 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-300"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-950/20 text-base">▶</span>
              Mulai transkripsi sekarang
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-slate-600 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-400 hover:text-white"
            >
              Open Quota Dashboard
              <span aria-hidden>↗</span>
            </a>
          </div>
          <dl className="grid gap-6 text-sm text-slate-400 sm:grid-cols-3">
            <div>
              <dt className="font-medium text-slate-300">Provider fallback</dt>
              <dd>Groq · HuggingFace · Together · Cohere · Transformers.js</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-300">Latensi rata-rata</dt>
              <dd>&lt; 450ms per chunk pada edge worker</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-300">Integritas data</dt>
              <dd>Streaming SSE + ekspor TXT/SRT/VTT</dd>
            </div>
          </dl>
        </div>
        <div className="relative isolate flex w-full items-center justify-center">
          <div className="absolute -inset-6 rounded-[3rem] bg-indigo-500/10 blur-3xl" aria-hidden />
          <div className="relative w-full max-w-md rounded-[2.5rem] border border-slate-700/60 bg-slate-900/50 p-8 shadow-xl shadow-indigo-500/20">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="inline-flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">●</span>
                SSE status
              </span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-widest">
                live
              </span>
            </div>
            <div className="mt-6 space-y-4 text-sm">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>job-92sa</span>
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                    Connected
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400" style={{ width: '68%' }} />
                </div>
                <p className="mt-3 text-xs text-slate-400">Chunks processed · raw 5/8 · quick 3/8 · enhanced 2/8</p>
              </div>
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 text-xs">
                <p className="font-medium text-slate-300">Event log</p>
                <ul className="mt-3 space-y-2 text-slate-400">
                  <li>[00:01] SSE connected · groq-primary</li>
                  <li>[00:04] raw chunk 3 diterima</li>
                  <li>[00:05] quick chunk 2 diterima</li>
                  <li>[00:07] transformer fallback siap &lt;320ms</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function FeatureHighlights(): ReactElement {
  return (
    <section className="mx-auto grid max-w-6xl gap-6 pt-16 md:grid-cols-3">
      {FEATURES.map((feature) => (
        <article
          key={feature.title}
          className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          <span className="text-3xl" aria-hidden>
            {feature.icon}
          </span>
          <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            {feature.title}
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{feature.description}</p>
        </article>
      ))}
    </section>
  )
}

export default function Page(): ReactElement {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 pb-24 pt-16 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="absolute top-[-15%] left-1/2 -z-10 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-indigo-400/20 blur-3xl" aria-hidden />
      <div className="container mx-auto flex max-w-6xl flex-col gap-20 px-4 lg:px-8">
        <HeroSection />
        <section id="panel-transkripsi" className="scroll-mt-32">
          <HomeClientShell />
        </section>
        <FeatureHighlights />
      </div>
    </main>
  )
}
