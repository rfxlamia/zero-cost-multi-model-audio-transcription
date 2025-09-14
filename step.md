Isi file ini adalah :
1. Step-by-step pengerjaan yang terstruktur (bullet points).
2. Penyiapan environment keys dan binding yang dibutuhkan (lengkap dengan contoh wrangler.toml dan .env).

Bagian A — Step-by-step pengerjaan (terstruktur, siap eksekusi)
0) Prasyarat & fondasi

* Pilih monorepo: pnpm + Turborepo. Struktur:

apps/web (Next.js 14 App Router)
apps/worker (Cloudflare Worker + Hono)
packages/shared (types, utils, schema zod, constants)


* Instal tools: pnpm, Node 18+/20+, wrangler, vercel CLI (opsional), git hooks (lint-staged + husky).
* Konvensi coding: TypeScript strict, ESLint, Prettier, commitlint.


1. Bootstrap proyek


* Buat repo: indonesian-transcription-zerocost.
* Init Next.js 14 (apps/web) dengan Tailwind, App Router, SSE-ready.
* Init Worker (apps/worker) dengan Hono, miniflare untuk dev, dan modul ESM.
* Buat packages/shared:

types: TranscriptionJob, TranscriptionChunk, ProviderUsage, dll (dari PRD).
constants: batas provider, ukuran batch, nama event SSE, nama KV keys.
utils: hash audio (SHA-256), segment time math, SRT/VTT generator, rate-limit helpers.




1. Provisioning Cloudflare (infra gratis sesuai PRD)


* Buat KV namespaces:

COMMUNITY_CACHE (community corrections)
RESPONSE_CACHE (cache hasil correction dan ASR)
QUOTA_COUNTERS (usage/quota per provider)
JOB_STATE (status job, pointer progres)


* Buat R2 bucket:

r2-audio (original uploads, chunks, artifacts)


* Buat D1 database:

Tabel: provider_usage, jobs, contributions, telemetry (minimal kolom: id, timestamps, counters).


* Siapkan binding Workers AI (AI) untuk ASR utama (model whisper atau setara) via wrangler binding.


1. Konfigurasi lingkungan & rahasia (ringkas, detail di Bagian B)


* Simpan semua API keys di Cloudflare Secrets (untuk Worker).
* Simpan URL Worker di NEXT_PUBLIC_API_BASE pada apps/web.
* Tambahkan APP_SECRET untuk enkripsi ringan (signing) di Worker.


1. Orkestrator API (Hono) — kerangka


* Route publik:

POST /api/transcribe/start: inisiasi job, metadata, pre-alloc resources.
POST /api/transcribe/:id/chunk: unggah chunk (atau signed PUT ke R2), enque ASR.
GET /api/transcribe/:id/stream: SSE events (status, raw, quick, enhanced).
POST /api/correct/batch: LLM correction batch (server-side, dipanggil internal).
GET /api/export/:id.(srt|txt|vtt|json|docx)
GET /api/quotas: status quota per provider.
POST /api/community/submit, POST /api/community/upvote


* Middleware:

CORS ketat (origin whitelist dari env)
Rate limit per IP (100/jam) dan per user (50 file/hari)
Input sanitization (zod + DOMPurify pada path text)
Signed anon user ID (cookie HttpOnly, SameSite=Lax)


* SSE: Kirim event “status”, “raw”, “quick”, “enhanced”, “progress”.


1. Jalur audio & chunking (browser + server)


* Rekam: MediaRecorder dengan timeslice 30000ms (30 detik).
* Unggah:

Potong file >10 menit menjadi chunks 30 detik.
Hash audio per chunk (SHA-256) untuk cek community cache.
Upload paralel dibatasi (maks 5 concurrent).


* Penyimpanan:

Simpan ke R2: audio/{jobId}/{index}.webm atau .wav
Simpan metadata job di KV: JOB_STATE:{jobId}




1. ASR utama + fallback


* Utama: Workers AI speech-to-text (pilih model whisper/ekivalen yang tersedia).

Panggil per chunk; simpan output ke KV RESPONSE_CACHE:{audioHash}:raw


* Fallback (browser): Transformers.js (Xenova whisper-tiny/small) jika Workers AI limit/habis atau offline.

Deteksi kemampuan device (navigator.deviceMemory; jika rendah, sarankan mode ringan).


* Normalisasi hasil: lowercase opsional, jaga tanda baca minimal.


1. Multi-provider LLM corrector (router pintar)


* Abstraksi provider: groq, huggingface, together, cohere, local (browser optional).
* Strategi:

Quick correction: model kecil/cepat (mis. phi-3-min setara) untuk respons <2–3 dtk.
Enhanced correction: model lebih kuat (llama/mixtral/gemma setara) secara batch (5 segmen).


* Router:

Urutan fallback: Groq → HF → Together → Cohere → Local.
Smart batching: kumpulkan 5 segmen sekaligus; hormati batas 30 req/menit dsb (sesuai PRD).
Kuota: baca/tulis QUOTA_COUNTERS; jika mendekati limit, preemptive switch.


* Cache:

RESPONSE_CACHE:{audioHash}:quick/enhanced/final (TTL beberapa hari).
Community cache cek sebelum panggil LLM: COMMUNITY_CACHE:{audioHash}.


* Prompt safety:

Sisipkan glossary jika ada.
Instruksi ketat “jaga makna, perbaiki ejaan/pemisah kata/pungtuasi, jangan parafrase berlebihan”.


* Confidence:

Skor sederhana: similarity(raw vs corrected), jumlah edit, heuristik kosa kata.




1. Progressive enhancement + SSE


* Alur per chunk:

Emit “raw” segera setelah ASR.
Kirim “quick” (LLM cepat).
Jadwalkan “enhanced” di background (batch) → emit saat siap.
“final” = enhanced || quick || raw (mana terbaik/tersedia).


* Event payload minimal: {chunkIndex, text, provider, confidence, tsRange}


1. UI/Frontend (Next.js)


* Komponen:

SmartRecorder (VAD opsional, waveform, indikator chunk).
MultiUploader (drag-drop, validasi format, antrean).
ProgressiveTranscriptView (raw/quick/enhanced toggle, compare mode).
ProviderStatus/QuotaDashboard (bar + ETA reset).
GlossaryManager (chip terms, import txt).
CommunityCache toggle.
ExportPanel (TXT/SRT/VTT/DOCX/JSON).


* A11y: ARIA live regions untuk SSE status, fokus jelas, reduced motion.
* Perf: lazy-load heavy libs (transformers.js), avoid hydration berat.


1. Ekspor & timestamp


* SRT/VTT builder: gabungkan segmen 30 detik, merge jika jarak <500ms.
* TXT: final text per segmen diurut.
* DOCX (enhancement fase 2): gunakan template minimal.
* Akurasi timestamp: toleransi ±500ms (DoD).


1. Telemetri & quotas


* Telemetry minimal ke D1:

provider_latencies, cache_hit_rates, correction_improvement (agregat anonim).


* Quota dashboard:

Ambil QUOTA_COUNTERS, tampilkan bar, resetAt per provider.


* Log kesalahan tanpa PII; sampling.


1. Keamanan & privasi


* HTTPS only, HSTS, CSP ketat (non-inline).
* Audio dienkripsi-at-rest di R2 (server-side encryption).
* Auto-delete 7 hari (cron Worker hapus R2 + KV).
* DOMPurify untuk konten yang dirender.
* Optional: Cloudflare Turnstile untuk form submit komunitas.


1. Guardrails zero-cost


* Batasi concurrency (maks 5 request LLM bersamaan).
* Dedupe: jangan panggil LLM jika hash+prompt sama (cache hit).
* Panjang prompt minimal (kompres raw text).
* Pakai community cache dulu.
* Hard-stop jika kuota hariannya hampir habis → switch ke browser-only.


1. QA inti (otomasi e2e ringan)


* Provider cascade: kuras kuota dummy → pastikan fallback.
* Cache effectiveness: ulang audio sama → hit <500ms.
* Network resilience: putus koneksi saat proses → resume.
* Memory stability: 50 chunks beruntun → tidak leak.
* Poor audio: tampilkan warning, tetap hasilkan output.


1. Deploy


* Deploy Worker (wrangler deploy), cek bindings/live logs.
* Deploy Web ke Vercel (atau Pages) → set NEXT_PUBLIC_API_BASE.
* Health checks: ping /api/quotas dan / root SSE.

Bagian B — Penyiapan environment keys, bindings, dan contoh konfigurasi

1. Daftar environment variables (server/Worker)


* GROQ_API_KEY — kunci Groq
* HF_API_TOKEN — Hugging Face Inference token
* TOGETHER_API_KEY — Together AI key
* COHERE_API_KEY — Cohere key
* APP_SECRET — secret untuk signing (cookies, nonce)
* ORIGIN_WHITELIST — daftar origin frontend (pisahkan dengan koma)
* LOG_LEVEL — info|warn|error
* OPTIONAL: TURNSTILE_SECRET — jika pakai bot protection
* OPTIONAL: SENTRY_DSN — jika pakai observability


1. Bindings Cloudflare (wrangler.toml)


* KV:

COMMUNITY_CACHE
RESPONSE_CACHE
QUOTA_COUNTERS
JOB_STATE


* R2:

R2_BUCKET (nama: r2-audio)


* D1:

DB (nama database D1)


* AI:

AI (binding Workers AI untuk ASR)




1. Environment variables (frontend Next.js)


* NEXT_PUBLIC_API_BASE — URL Worker (mis. https://your-worker.your-subdomain.workers.dev)
* NEXT_PUBLIC_ENV — development|production
* NEXT_PUBLIC_ENABLE_TRANSFORMERS — true/false (toggle fallback)
* OPTIONAL: NEXT_PUBLIC_TURNSTILE_SITEKEY
* OPTIONAL: NEXT_PUBLIC_SENTRY_DSN


1. Contoh wrangler.toml (apps/worker)

tomlDownloadCopy code Wrapname = "transcript-orchestrator"
main = "src/index.ts"
compatibility_date = "2024-11-01"
workers_dev = true

[vars]
LOG_LEVEL = "info"
ORIGIN_WHITELIST = "http://localhost:3000,https://yourapp.vercel.app"

[[kv_namespaces]]
binding = "COMMUNITY_CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "RESPONSE_CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "QUOTA_COUNTERS"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "JOB_STATE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "r2-audio"

[[d1_databases]]
binding = "DB"
database_name = "zerocost-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[ai]
binding = "AI" # Workers AI binding untuk ASR

[observability]
enabled = true

1. Menyetel secrets Worker (Cloudflare)

bashDownloadCopy code Wrap# Jalankan di folder apps/worker
wrangler secret put GROQ_API_KEY
wrangler secret put HF_API_TOKEN
wrangler secret put TOGETHER_API_KEY
wrangler secret put COHERE_API_KEY
wrangler secret put APP_SECRET
wrangler secret put TURNSTILE_SECRET   # opsional

1. Contoh .env.local (apps/web)

bashDownloadCopy code WrapNEXT_PUBLIC_API_BASE="https://transcript-orchestrator.your-subdomain.workers.dev"
NEXT_PUBLIC_ENV="development"
NEXT_PUBLIC_ENABLE_TRANSFORMERS="true"
# Opsional
NEXT_PUBLIC_TURNSTILE_SITEKEY=""
NEXT_PUBLIC_SENTRY_DSN=""

1. Pemetaan KV keys (disiplin penamaan)


* COMMUNITY_CACHE:{audioHash} → { text, corrections, confidence, upvotes, contributor }
* RESPONSE_CACHE:{audioHash}:raw|quick|enhanced|final → string teks
* QUOTA_COUNTERS:{provider}:day:{YYYYMMDD} → { used, limit, resetAt }
* JOB_STATE:{jobId} → TranscriptionJob (ringkas: status, chunks[], providers[])


1. Skema D1 minimal (SQL singkat)

sqlDownloadCopy code WrapCREATE TABLE provider_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT,
  used INTEGER,
  limit INTEGER,
  reset_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  status TEXT,
  duration REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audio_hash TEXT,
  text TEXT,
  contributor TEXT,
  upvotes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT,
  value REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

1. Contoh router fallback LLM (pseudo-TypeScript)

tsDownloadCopy code Wraptype Provider = "groq" | "huggingface" | "together" | "cohere" | "local";

export async function correctBatch(texts: string[], ctx: Env) {
  const providers: Provider[] = ["groq","huggingface","together","cohere","local"];
  for (const p of providers) {
    const ok = await hasQuota(p, ctx);
    if (!ok) continue;
    try {
      const out = await callProvider(p, texts, ctx); // batching 5 segmen
      await incQuota(p, texts.length, ctx);
      return { provider: p, texts: out };
    } catch (e) {
      await flagFailure(p, e, ctx);
      continue;
    }
  }
  // terakhir: kembalikan teks asli jika semua gagal
  return { provider: "none", texts };
}

1. Contoh event SSE payload

jsonDownloadCopy code Wrap{ "type":"status", "jobId":"...", "status":"transcribing" }
{ "type":"raw", "chunkIndex":3, "text":"..." }
{ "type":"quick", "chunkIndex":3, "text":"...", "provider":"groq", "confidence":0.72 }
{ "type":"enhanced", "chunkIndex":0, "text":"...", "provider":"huggingface", "confidence":0.84 }
{ "type":"done", "jobId":"..." }

1. Hash audio di browser (unik per chunk)

tsDownloadCopy code Wrapasync function hashArrayBuffer(buf: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,"0")).join("");
}

1. SRT builder singkat

tsDownloadCopy code Wrapfunction toSrt(segments: {i:number; start:number; end:number; text:string}[]) {
  return segments.map(s =>
    `${s.i+1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`
  ).join("\n");
}
Checklist praktis per hari (selaras PRD timeline)

* D1: Monorepo + Worker boilerplate + abstractions provider
* D2: Integrasi Groq + quota counters
* D3: Tambah HuggingFace + fallback router
* D4: Smart batching + penghemat prompt
* D5: Pipeline progressive (raw → quick → enhanced) + SSE shape
* D6: Community cache (KV) + API
* D7: Client SSE + Transcript view
* D8: Quota dashboard + Provider status
* D9: Export (TXT/SRT/VTT) + akurasi timestamp
* D10: Transformers.js fallback (browser) + gating device
* D11: Uji cascade provider + simulasi kehabisan kuota
* D12: Optimisasi performa + cache
* D13: Security hardening + rate limiting + CSP
* D14: Final QA + deploy

Catatan penting untuk zero-cost nyata

* Selalu cek COMMUNITY_CACHE dan RESPONSE_CACHE sebelum memanggil LLM/ASR.
* Batch 5 segmen/permintaan. Jangan kirim segmen <5 kecuali flush terakhir atau timeout batching (mis. 700ms).
* Cache prompt signature: hash(audioHash + glossary + mode) → kunci cache.
* Batasi ukuran input LLM: potong panjang segmen, gunakan instruksi ringkas.
* Putuskan “enhanced” hanya jika quick-confidence < ambang (mis. 0.8) untuk hemat kuota.
* Bila semua provider limit: auto-switch ke browser-only dan tampilkan banner “mode offline/hemat kuota”.

Itu dia. Kalau kamu mau, aku bisa bantu bikin template repo awal (struktur folder, wrangler.toml, dan contoh route Hono) langsung dari rencana di atas.
