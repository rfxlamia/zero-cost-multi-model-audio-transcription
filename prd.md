PRD.md

1. Ringkasan Eksekutif
   Tujuan: Membangun web app transkripsi suara-ke-teks Bahasa Indonesia dengan pipeline dual-model (ASR + Multi-Provider LLM correction) yang mencapai zero-cost sesungguhnya melalui strategi smart fallback, batching, dan maksimalisasi multiple free-tier providers.
   Output fase ini:

- Web app dengan multi-provider LLM fallback system (Groq, HF, Together, Cohere)
- Smart quota management untuk 20,000+ corrections/day gratis
- Progressive correction dengan immediate + enhanced results
- Caching layer untuk minimize API calls
- Community correction sharing system
- True $0 operational cost untuk <100 users/day

2. Ruang Lingkup
   MVP (wajib):

- Upload/rekam audio hingga 10 menit (chunk 30 detik) — UI guard 8 menit untuk buffer kuota
- ASR via Cloudflare Workers AI (10 min/day) + Transformers.js fallback
- Multi-tier LLM correction (Groq → HF → Together → Cohere → Local)
- Smart batching (5 segments per LLM request)
- Response caching dengan Cloudflare KV
- Progressive enhancement (quick → enhanced correction)
- SSE streaming untuk real-time updates
- Export TXT/SRT dengan timestamp
- Community cache untuk popular corrections
- Quota dashboard real-time

Non‑goals (fase ini):

- Speaker diarization
- Video transcription
- Real-time WebSocket streaming
- Custom model fine-tuning
- Team collaboration
- Mobile native app
- Batch >10 files sekaligus
- Translation ke bahasa lain
- Custom domain/branding

3. Asumsi & Batasan
   Asumsi:

- User memiliki browser modern (Chrome 90+, Firefox 88+, Safari 14+)
- Koneksi internet stabil minimal 1 Mbps
- Audio dominan Bahasa Indonesia (sedikit code-switching OK)
- Device minimal 4GB RAM untuk Transformers.js fallback
- User bersedia menunggu 2-3 detik untuk enhanced correction

Batasan:

- Groq: 30 req/min, 14,400 req/day
- HuggingFace: ~1,000 req/day
- Together AI: $25 free credit (once)
- Cohere: 100 calls/minute trial
- Workers AI: 10 menit audio/day
- Cloudflare KV: 100k reads/day
- R2: 10GB storage free
- Max file size: 100MB per upload (UI guard 80MB untuk safety kuota)

4. Persona & Use Case
   Persona Primer: Content Creator Budget-Conscious

- YouTuber/Podcaster Indonesia emerging
- Produksi 2-3 video/minggu @ 5-10 menit
- Butuh subtitle akurat tanpa subscription
- Tech-savvy menengah, paham cloud basics
- Device: Laptop mid-range 8GB RAM

Persona Sekunder: Mahasiswa Skripsi

- Transkripsi wawancara penelitian (5-10 interviews)
- Budget sangat terbatas (idealnya gratis)
- Butuh akurasi tinggi untuk analisis kualitatif
- Privacy-conscious (data penelitian sensitif)
- Familiar dengan Google Docs/Word

Use Cases Utama:

1. Upload rekaman podcast 8 menit → immediate transcription → enhanced correction → export SRT
2. Record Zoom interview → apply glossary istilah teknis → progressive enhancement → copy to thesis
3. Batch process 5 wawancara → leverage community cache → export semua ke DOCX
4. Live record presentasi → real-time rough transcript → background enhancement → final PDF

5) Arsitektur Frontend (tingkat tinggi)
   ┌─────────────────┐ ┌──────────────────┐ ┌─────────────────┐
   │ Browser UI │─────▶│ CF Worker Edge │─────▶│ Workers AI │
   │ Next.js/React │◀─────│ (Orchestrator) │◀─────│ (ASR Primary) │
   └─────────────────┘ SSE └──────────────────┘ └─────────────────┘
   │ │ │
   │ ▼ [Fallback]
   │ ┌──────────────────┐ ▼
   │ │ Smart LLM Router│ ┌─────────────────┐
   │ └──────────────────┘ │ Transformers.js │
   │ │ │ (Browser ASR) │
   ▼ ▼ └─────────────────┘
   ┌─────────────────┐ ┌──────────────────┐
   │ IndexedDB │ │ Multi-Provider │
   │ Local Cache │ │ LLM Fallback │
   └─────────────────┘ │ ┌────────────┐ │
   │ │ Groq │ │
   ┌─────────────────┐ │ ├────────────┤ │
   │ Community │◀────▶│ │HuggingFace │ │
   │ Cache (KV) │ │ ├────────────┤ │
   └─────────────────┘ │ │ Together │ │
   │ ├────────────┤ │
   │ │ Cohere │ │
   │ └────────────┘ │
   └──────────────────┘

6) Data Model (draft)
   typescriptDownloadCopy code Wrapinterface TranscriptionJob {
   id: string
   userId: string // anonymous UUID
   status: 'uploading' | 'chunking' | 'transcribing' | 'correcting' | 'enhancing' | 'done' | 'error'
   audioUrl?: string // R2 temporary URL
   duration: number
   chunks: TranscriptionChunk[]
   providers: ProviderUsage[]
   metadata: {
   filename: string
   language: 'id' | 'id-en' // Indonesian or mixed
   glossary?: string[]
   createdAt: Date
   expiresAt: Date // 7 days
   quality: QualityMetrics
   }
   }

interface TranscriptionChunk {
index: number
startTime: number
endTime: number
audioHash: string // for community cache
transcription: {
raw: string // ASR output
quick?: string // immediate correction (Phi-3)
enhanced?: string // enhanced correction (Groq/HF)
final: string // best available
confidence: number
}
correctionProvider?: string // which LLM was used
cached: boolean // from community cache?
}

interface ProviderUsage {
name: 'groq' | 'huggingface' | 'together' | 'cohere' | 'local'
requestsUsed: number
quotaRemaining: number
resetAt: Date
averageLatency: number
}

interface QualityMetrics {
wer?: number // word error rate if reference available
corrections: number // number of corrections made
enhancement: number // % improvement from raw
userRating?: 1 | 2 | 3 | 4 | 5
}

interface CommunityContribution {
audioHash: string
transcription: string
corrections: string
language: string
upvotes: number
contributor: string // anonymous ID
verifiedBy?: string[] // other users who verified
} 7) Komponen UI (MVP)

- SmartRecorder: MediaRecorder + VAD + real-time waveform + chunk indicator
- MultiUploader: Drag-drop dengan queue management + format validation
- ProgressiveTranscriptView:

Raw transcript (immediate)
Quick correction badge
Enhanced correction indicator
Side-by-side comparison mode

- ProviderStatus: Real-time quota bars untuk setiap provider
- GlossaryManager: Add/remove/import domain terms
- CommunityCache: Toggle use/contribute community corrections
- ExportPanel: Multi-format (TXT/SRT/DOCX/JSON) dengan quality indicators
- QuotaDashboard: Visual quotas semua providers + reset timers
- CorrectionToggle: 3-way (Off/Quick/Enhanced)

8. Interaksi Kunci & Shortcut

- Space: Play/pause audio playback
- R: Toggle recording
- Cmd/Ctrl+Enter: Force enhance current segment
- Tab: Navigate between segments
- E: Quick export menu
- Q: Toggle quality view (raw vs corrected)
- C: Toggle community cache
- 1-5: Rate current transcription
- Cmd/Ctrl+B: Batch process queued files
- Escape: Cancel current operation
- Arrow keys: Navigate chunks when focused

9. Aksesibilitas (A11y)

- ARIA live regions untuk status updates
- Keyboard navigation lengkap dengan visible focus
- Screen reader announcements untuk provider switches
- Contrast ratio WCAG AAA untuk critical text
- Reduced motion mode untuk progress indicators
- Audio descriptions untuk waveform visualization
- Skip links untuk navigation
- Error messages dengan clear actions
- Touch targets minimum 48x48px
- Color-blind safe indicators (not just color)

10. Performa & Budget
    Performance Metrics:

- FCP < 1.2s (tanpa model load)
- TTI < 2.5s
- CLS < 0.05
- Bundle size < 150KB initial (lazy load models)
- Transformers.js model: lazy load on-demand (~400MB)
- Memory usage < 400MB active (tanpa model)
- Cache hit ratio > 60% setelah 1 minggu

Resource Quotas:

- API calls: max 5 concurrent
- Batch size: 5 segments per LLM call
- Cache: 100MB IndexedDB per user
- Upload: chunk setiap 1MB
- Retry: exponential backoff 1s, 2s, 4s, 8s

Free Tier Maximization:

- Groq: 14,400 req/day (primary)
- HuggingFace: 1,000 req/day (secondary)
- Together: $25 credit = ~2000 corrections
- Cohere: 3,000 req trial
- Total capacity: ~20,000 corrections/day FREE

11. Keamanan & Privasi

- HTTPS only, HSTS enabled
- CSP headers strict, no inline scripts
- Audio encrypted at rest di R2
- Auto-delete setelah 7 hari (GDPR compliant)
- Anonymous user IDs (UUID v4)
- No PII dalam logs
- Rate limiting:

Per IP: 100 req/hour
Per user: 30 req/hour, 50 files/day
Per chunk: 30 seconds max

- Input sanitization semua text fields
- XSS protection via DOMPurify
- Bot mitigation: Cloudflare Turnstile (opsional via TURNSTILE_SECRET / NEXT_PUBLIC_TURNSTILE_SITEKEY)
- Secure headers (X-Frame-Options, X-Content-Type-Options)
- Optional: client-side E2E encryption

12. Theming

- Design System:

Primary: Indigo-600 (#4f46e5)
Success: Emerald-600 (#059669)
Warning: Amber-600 (#d97706)
Error: Rose-600 (#e11d48)
Neutral: Zinc scale

- Typography:

Font: Inter var + IBM Plex Mono (code)
Scale: 14/16/18/24/32px

- Spacing: 4px grid (4, 8, 12, 16, 24, 32, 48)
- Dark mode: Auto-detect + manual toggle
- Motion: Respect prefers-reduced-motion
- Breakpoints: 640/768/1024/1280px

13. Risiko, Antitesis, dan Skenario Terburuk
    Risiko Teknis:

1)  Semua provider limit tercapai bersamaan

Mitigasi: Community cache + browser-only mode
Fallback: Pure Transformers.js operation

2.  Model Transformers.js terlalu berat untuk device user

Mitigasi: Deteksi RAM, suggest desktop/upgrade
Fallback: Server-side queue untuk process nanti

3.  LLM hallucination mengubah makna

Mitigasi: Confidence scoring, show original
Fallback: Flag low-confidence untuk manual review

4.  Groq/HF mengubah policy jadi berbayar

Mitigasi: Abstract provider interface, easy switch
Fallback: Community self-hosted model pool

Risiko Bisnis:

1.  User abuse untuk content illegal

Mitigasi: Audio fingerprinting, flag suspicious
Response: Terms of Service, report mechanism

2.  Viral usage melebihi all quotas

Mitigasi: Waitlist, queue system, premium tier ready
Response: Gradual rollout, usage analytics

Worst Case Scenarios:

- Cloud providers down → Full browser mode, P2P via WebRTC
- Mass quota exhaustion → Queue system, notify when ready
- Data breach → All data ephemeral, auto-delete
- Legal takedown → Modular architecture, can remove features

14. Kriteria Penerimaan (DoD)

- Upload 10-min audio berhasil dengan chunking otomatis
- Transcribe Indonesia dengan WER <20% (audio bersih)
- LLM correction improve accuracy minimal 10%
- Provider fallback seamless tanpa error user-facing
- 5 providers integrated dengan auto-switching
- Cache hit ratio >50% untuk common phrases
- Community contributions functional
- Progressive enhancement visible dalam 3 detik
- Export SRT dengan timestamp akurat ±500ms
- Quota dashboard real-time update
- Zero cost validated untuk 50 users/day
- Load time <2s di 4G network
- Mobile responsive 320-1920px
- Dark mode tanpa UI glitches
- 100 sequential transcriptions tanpa memory leak

15. QA — Kasus Uji Inti

1) Provider Cascade Test

Exhaust Groq quota → auto-switch HF → verify seamless

2. Batch Upload Test

Upload 5 files × 5MB → all process → no timeout

3. Quality Regression Test

Poor audio → warning → still output → measure WER

4. Cache Effectiveness

Repeat same audio 3x → 2nd/3rd from cache → <500ms

5. Progressive Enhancement

Watch quick → enhanced transition → verify improvement

6. Community Contribution

Submit correction → appear for others → upvote works

7. Quota Exhaustion Recovery

Hit all limits → browser fallback → still functional

8. Concurrent Users

10 users simultaneously → no race conditions

9. Memory Leak Test

Process 50 chunks → memory stable → no crash

10. Network Resilience

Disconnect mid-process → reconnect → resume/retry

16. Roadmap
    Week 1-2 (MVP Core):

- Day 1-2: Setup monorepo, Cloudflare Worker, multi-provider abstraction
- Day 3-4: Implement Groq + HuggingFace providers with fallback
- Day 5-6: Smart batching, quota management system
- Day 7-8: Progressive enhancement pipeline
- Day 9-10: Community cache dengan KV
- Day 11-12: Frontend SSE integration, transcript viewer
- Day 13-14: Testing, optimization, deploy

Week 3-4 (Enhancement):

- Transformers.js browser fallback complete
- Together AI + Cohere integration
- Advanced caching strategies
- Export formats (DOCX, VTT)
- Glossary system with persistence

Month 2:

- Local Phi-3 deployment option
- P2P correction sharing via WebRTC
- Batch processing UI
- Analytics dashboard
- Premium tier preparation (Stripe ready)

Month 3:

- Speaker diarization (pyannote)
- Video support (extract audio)
- API for developers
- Mobile PWA enhanced
- Self-host documentation
