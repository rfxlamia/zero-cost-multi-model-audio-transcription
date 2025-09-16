For the English version, please see [README.md](./README.md).

# TranscriptorAI: Transkripsi Bahasa Indonesia Gratis

**TranscriptorAI** adalah aplikasi web voice-to-text yang andal dan gratis, dirancang khusus untuk Bahasa Indonesia. Proyek ini memanfaatkan strategi multi-provider yang canggih, *smart batching*, dan cache berbasis komunitas untuk menghasilkan transkripsi berkualitas tinggi tanpa biaya langganan.

Proyek ini dibuat untuk para kreator konten, jurnalis, mahasiswa, dan peneliti yang membutuhkan transkripsi Bahasa Indonesia yang akurat dengan anggaran terbatas.

<p align="left">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frfxlamia%2Ftranscriptor-ai"><img src="https://img.shields.io/badge/Deploy%20to-Vercel-black?style=flat-square&logo=vercel" alt="Deploy to Vercel"></a>
  <a href="https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Frfxlamia%2Ftranscriptor-ai"><img src="https://img.shields.io/badge/Deploy%20to-Cloudflare-F38020?style=flat-square&logo=cloudflare" alt="Deploy to Cloudflare Workers"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License: MIT"></a>
  <a href="https://github.com/rfxlamia"><img src="https://img.shields.io/badge/GitHub-rfxlamia-181717?style=flat-square&logo=github" alt="rfxlamia on GitHub"></a>
</p>

---

## Fitur Utama

*   **Benar-Benar Gratis:** Secara cerdas merutekan permintaan ke berbagai penyedia API gratis (Groq, HuggingFace, dll.) untuk menghindari biaya pada penggunaan normal.
*   **Koreksi Progresif:** Dapatkan transkrip mentah secara instan, diikuti koreksi cepat oleh AI, dan akhirnya versi yang telah disempurnakan dengan akurasi tinggi dalam hitungan detik.
*   **Multi-Provider Fallback:** Backend yang tangguh dan secara otomatis beralih antar penyedia LLM untuk memastikan ketersediaan tinggi dan kecepatan optimal.
*   **Cache Komunitas:** Transkripsi audio populer di-cache dan dibagikan, mengurangi pemrosesan berulang dan mempercepat hasil untuk semua orang.
*   **Smart Batching:** Mengelompokkan segmen transkripsi ke dalam satu panggilan API untuk memaksimalkan efisiensi dan mematuhi batas tarif (rate limit) penyedia.
*   **Real-time & Asinkron:** Menggunakan Server-Sent Events (SSE) untuk pembaruan real-time di frontend saat audio Anda diproses.
*   **Client-Side Fallback:** Menyertakan model ASR berbasis browser (Transformers.js) sebagai fallback terakhir untuk memastikan fungsionalitas bahkan jika semua penyedia cloud sedang tidak aktif.
*   **Tumpukan Teknologi Modern:** Dibangun dengan Next.js, Tailwind CSS, dan Cloudflare Workers untuk pengalaman pengguna yang cepat, skalabel, dan modern.
*   **Privasi Data:** File audio dihapus secara otomatis setelah 7 hari. Tidak ada Informasi Identitas Pribadi (PII) yang disimpan.
*   **Opsi Ekspor:** Unduh transkrip akhir Anda dalam format TXT atau SRT.

## Gambaran Arsitektur

Sistem ini dirancang sebagai monorepo dengan frontend Next.js dan backend Cloudflare Worker yang bertindak sebagai orkestrator cerdas.

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Browser UI    │─────▶│  CF Worker Edge  │─────▶│  Workers AI     │
│  Next.js/React  │◀─────│   (Orchestrator) │◀─────│  (ASR Primary)  │
└─────────────────┘ SSE  └──────────────────┘      └─────────────────┘
        │                         │                          │
        │                         ▼                     [Fallback]
        │                 ┌──────────────────┐              ▼
        │                 │  Smart LLM Router│     ┌─────────────────┐
        │                 └──────────────────┘     │ Transformers.js │
        │                         │                 │  (Browser ASR)  │
        ▼                         ▼                 └─────────────────┘
┌─────────────────┐      ┌──────────────────┐
│  IndexedDB      │      │   Multi-Provider  │
│  Local Cache    │      │   LLM Fallback    │
└─────────────────┘      │  ┌────────────┐  │
                         │  │   Groq     │  │
┌─────────────────┐      │  ├────────────┤  │
│  Community      │◀────▶│  │HuggingFace │  │
│  Cache (KV)     │      │  ├────────────┤  │
└─────────────────┘      │  │ Together   │  │
                         │  ├────────────┤  │
                         │  │  Cohere    │  │
                         │  └────────────┘  │
└──────────────────┘
```

### Alur Progresif (3 Tahap)

```
ASR (mentah) → Koreksi cepat → Koreksi sempurna
  │               │                   │
  ├─ kirim SSE: raw(chunk)           │
  ├─ cache: RESPONSE_CACHE:raw       │
  ▼                                   ▼
 kirim SSE quick(chunk)              kirim SSE enhanced(chunk)
 perbarui JOB_STATE.final = quick    perbarui JOB_STATE.final = enhanced
 cache quick                         cache enhanced
```

Tipe event SSE: `status`, `raw`, `quick`, `enhanced`, `done`, `error`.

## Tumpukan Teknologi

| Kategori          | Teknologi                                        |
| ----------------- | ------------------------------------------------ |
| **Framework**     | Next.js 14 (App Router)                          |
| **Edge Runtime**  | Cloudflare Workers                               |
| **Edge Framework**| Hono                                             |
| **Bahasa**        | TypeScript                                       |
| **Styling**       | Tailwind CSS                                     |
| **Penyedia ASR**  | Cloudflare Workers AI, Transformers.js           |
| **Penyedia LLM**  | Groq, HuggingFace, Together.ai, Cohere           |
| **Caching**       | Cloudflare KV (Komunitas), IndexedDB (Lokal)     |
| **Penyimpanan**   | Cloudflare R2                                    |
| **Database**      | Cloudflare D1                                    |

## Mulai Cepat

- Satu baris perintah dev: `pnpm i && pnpm dev`

Perintah ini menjalankan aplikasi web Next.js dan orkestrator Cloudflare Worker secara bersamaan melalui Turborepo.

## Memulai

### 1. Clone Repositori

```bash
git clone https://github.com/rfxlamia/transcriptor-ai.git
cd transcriptor-ai
```

### 2. Instal Dependensi

Ini adalah monorepo pnpm.

```bash
pnpm install
```

### 3. Atur Variabel Lingkungan

Worker backend memerlukan kunci API untuk berfungsi. Buat file `.dev.vars` di direktori `apps/worker`:

`apps/worker/.dev.vars`:
```ini
# Origin yang diizinkan untuk pengembangan lokal
ORIGIN_WHITELIST="http://localhost:3000"

# Opsional: Atur level logging (info, debug, error)
LOG_LEVEL="info"

# --- Kunci API Penyedia (setidaknya satu direkomendasikan) ---
# Dapatkan dari https://console.groq.com/keys
GROQ_API_KEY="..."

# Dapatkan dari https://huggingface.co/settings/tokens
HF_API_TOKEN="..."

# Anda dapat menambahkan kunci penyedia lain di sini saat terintegrasi
# TOGETHER_API_KEY="..."
# COHERE_API_KEY="..."
```

### 4. Jalankan Server Pengembangan

Perintah ini menggunakan `turbo` untuk menjalankan aplikasi web Next.js dan Cloudflare Worker secara bersamaan.

```bash
pnpm dev
```

*   Aplikasi web akan tersedia di `http://localhost:3000`
*   API Worker akan tersedia di `http://127.0.0.1:8787`

## Perkembangan Terbaru

### Day 9–10 (Sesi Terkini)

* **Pipeline ekspor diperketat** – Menambahkan utilitas bersama dengan toleransi waktu ±0,5 detik dan penggabungan jeda, merombak rute ekspor worker, serta memperluas pengujian untuk output TXT/SRT/VTT/JSON.
* **Fallback Transformers.js** – Membuat hook klien untuk memuat `@xenova/transformers@^2.17.2` secara malas, memeriksa memori perangkat dan izin dari worker, lalu memasukkan hasil ASR lokal ke tampilan transkrip dengan tombol preload dan status yang jelas.
* **Pengujian & debugging** – Menjalankan `pnpm exec vitest run --pool=threads --poolOptions.threads.maxThreads=1 --poolOptions.threads.minThreads=1 --reporter=verbose` agar stabil di sandbox; menyesuaikan versi dependensi dengan rilis terbaru Transformers.js dan mendokumentasikan instalasi manual ketika DNS sandbox memblokir npm.
* **Hambatan tersisa** – Tidak ada hambatan fungsional; telemetri penggunaan fallback masih lokal dan bisa ditingkatkan di tahap berikutnya.

### Pekerjaan Lanjutan (Target Day 11–12)

* **Day 11 – Ketahanan fallback & kuota** (`prd.md`, `prd.yaml`, `step.md`): uji stres router penyedia, simulasi kehabisan kuota, pastikan switch pre-emptive, dan dokumentasikan perilaku pemulihan.
* **Day 12 – Performa & caching**: profil latensi API, sesuaikan jeda flush batching dan kompresi prompt, tingkatkan rasio hit KV, optimalkan bundel frontend, dan munculkan metrik di dashboard.

## Variabel Lingkungan & Bindings

Worker (Cloudflare)

| Kunci | Wajib | Deskripsi |
| --- | --- | --- |
| `ORIGIN_WHITELIST` | ya | Daftar origin yang diizinkan untuk CORS, dipisahkan koma. |
| `LOG_LEVEL` | tidak | `info` | `warn` | `error`. |
| `APP_SECRET` | direkomendasikan | Digunakan untuk penandatanganan ringan/nonce. |
| `GROQ_API_KEY` | opsional | Mengaktifkan penyedia Groq; nonaktifkan melalui `DISABLE_GROQ=1`. |
| `HF_API_TOKEN` | opsional | Mengaktifkan Hugging Face Inference API; nonaktifkan melalui `DISABLE_HF=1`. |
| `TOGETHER_API_KEY` | opsional | Dicadangkan untuk penyedia Together. |
| `COHERE_API_KEY` | opsional | Dicadangkan untuk penyedia Cohere. |
| `DISABLE_GROQ` | tidak | `'1'` atau `true` untuk melewati Groq di router. |
| `DISABLE_HF` | tidak | `'1'` atau `true` untuk melewati HF di router. |

Frontend (Next.js)

| Kunci | Wajib | Deskripsi |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE` | ya | URL dasar dari orkestrator Worker (misalnya `https://your-worker.workers.dev`). |
| `NEXT_PUBLIC_ENV` | tidak | `development` atau `production`. |
| `NEXT_PUBLIC_ENABLE_TRANSFORMERS` | tidak | Mengatur fallback di browser (Transformers.js). |

Wrangler Bindings (apps/worker/wrangler.toml)

| Binding | Tipe | Tujuan |
| --- | --- | --- |
| `COMMUNITY_CACHE` | KV | Koreksi yang dikirimkan komunitas (teks + meta). |
| `RESPONSE_CACHE` | KV | Cache koreksi berdasarkan signature `sha256(audioHash|mode|glossary)`. |
| `QUOTA_COUNTERS` | KV | Penghitung per menit/hari, metrik keberhasilan/kegagalan penyedia. |
| `JOB_STATE` | KV | Status per pekerjaan (potongan, stempel waktu, tahap). |
| `R2_BUCKET` | R2 | Penyimpanan audio (asli/potongan/artefak). |
| `DB` | D1 | Tabel telemetri dan penggunaan (opsional). |
| `AI` | Workers AI | Binding ASR utama (setara Whisper). |

Kuota & Batas (default)

- Ukuran batch LLM: 5 segmen
- Batas per menit (contoh): Groq 30/menit; Cohere 100/menit
- Batas per hari (contoh): Groq 14.400/hari; HF 1.000/hari
- TTL cache respons: 7 hari

Lihat `packages/shared/constants/index.ts` dan `apps/worker/src/services/quota.ts`.

## Struktur Proyek

Proyek ini adalah monorepo yang dikelola oleh pnpm dan Turborepo.

*   `apps/web`: Aplikasi frontend Next.js.
*   `apps/worker`: Backend Cloudflare Worker yang menangani ASR, koreksi LLM, dan routing.
*   `packages/shared`: Tipe, skema, dan konstanta bersama yang digunakan oleh aplikasi web dan worker.
*   `packages/ui`: (Jika ada) Komponen React bersama.

## Peta Jalan (Roadmap)

Tujuan kami adalah untuk terus meningkatkan akurasi, kecepatan, dan rangkaian fitur TranscriptorAI sambil tetap berpegang pada filosofi "benar-benar gratis".

### Minggu 1-2 (Core MVP)
- [x] Pengaturan Monorepo & Cloudflare Worker
- [x] Integrasi Groq + HuggingFace dengan Fallback
- [x] Smart Batching & Manajemen Kuota
- [x] Alur Peningkatan Progresif (Cepat + Ditingkatkan)
- [x] Cache Komunitas dengan Cloudflare KV
- [x] Integrasi SSE Frontend & Penampil Transkrip

### Minggu 3-4 (Peningkatan)
- [x] Fallback ASR Berbasis Browser (Transformers.js)
- [ ] Integrasi Together AI & Cohere
- [ ] Strategi Caching Tingkat Lanjut
- [x] Format Ekspor Tambahan (TXT/SRT/VTT/JSON)
- [ ] Sistem Glosarium untuk istilah spesifik domain

### Masa Depan
- [ ] Diarisasi Pembicara
- [ ] Berbagi Koreksi P2P (WebRTC)
- [ ] API untuk Developer
- [ ] Dokumentasi Self-hosting

### Ringkasan Terbaru (Day 9–10)

* **Pipeline ekspor diperketat** – Menambahkan utilitas bersama dengan toleransi waktu ±0,5 detik dan penggabungan jeda, merombak rute ekspor worker, serta memperluas pengujian untuk output TXT/SRT/VTT/JSON.
* **Fallback Transformers.js** – Membuat hook klien untuk memuat `@xenova/transformers@^2.17.2` secara malas, memeriksa memori perangkat dan izin dari worker, lalu memasukkan hasil ASR lokal ke tampilan transkrip dengan tombol preload dan status yang jelas.
* **Pengujian & debugging** – Menjalankan `pnpm exec vitest run --pool=threads --poolOptions.threads.maxThreads=1 --poolOptions.threads.minThreads=1 --reporter=verbose` agar stabil di sandbox; menyesuaikan versi dependensi dengan rilis terbaru Transformers.js dan mendokumentasikan instalasi manual ketika DNS sandbox memblokir npm.
* **Hambatan tersisa** – Tidak ada hambatan fungsional; telemetri penggunaan fallback masih lokal dan bisa ditingkatkan di tahap berikutnya.

### Target Berikutnya (Day 11–12)

* **Day 11 – Ketahanan fallback & kuota** (`prd.md`, `prd.yaml`, `step.md`): uji stres router penyedia, simulasi kehabisan kuota, pastikan switch pre-emptive, dan dokumentasikan perilaku pemulihan.
* **Day 12 – Performa & caching**: profil latensi API, sesuaikan jeda flush batching dan kompresi prompt, tingkatkan rasio hit KV, optimalkan bundel frontend, dan munculkan metrik di dashboard.

## Berkontribusi
## Panduan Deployment

Cloudflare Workers (orkestrator)

1) Konfigurasikan bindings di `apps/worker/wrangler.toml` (KV, R2, D1, AI).
2) Atur secrets:

```bash
cd apps/worker
wrangler secret put GROQ_API_KEY
wrangler secret put HF_API_TOKEN
wrangler secret put APP_SECRET
# opsional: TOGETHER_API_KEY, COHERE_API_KEY, TURNSTILE_SECRET
```

3) Deploy:

```bash
pnpm -F @transcriptorai/worker deploy
```

Next.js (Vercel atau Cloudflare Pages)

1) Atur `NEXT_PUBLIC_API_BASE` ke URL Worker Anda.
2) Deploy melalui UI/CLI penyedia Anda.

Cloudflare Pages (+ Functions) didukung; repo ini mengasumsikan orkestrator Worker terpisah untuk skala dan kuota yang lebih jelas.

## Referensi API

Rute publik (Worker)

- `GET /` → Teks health check
- `GET /api/health` → Ping ke KV/R2/D1
- `GET /api/quotas` → Penghitung per menit/hari untuk setiap penyedia
- `GET /api/metrics` → Status penyedia, tingkat keberhasilan/kegagalan, statistik antrian/semaphore (dibatasi tarif, di-cache)
- `POST /api/transcribe/start` → Inisialisasi pekerjaan; mengembalikan `{ id, status }`
- `POST /api/transcribe/:id/chunk` → Tambah/ganti potongan `{ audioHash, text, index?, startTime?, endTime? }`
- `GET /api/transcribe/:id/stream` → Stream SSE dari `status/raw/quick/enhanced/done`
- `POST /api/correct/batch` → Koreksi batch (penggunaan internal); cache-first
- `POST /api/community/submit` → Kirim koreksi komunitas `{ audioHash, text, ... }`
- `POST /api/community/upvote` → Upvote entri komunitas `{ audioHash }`
- `GET /api/export/:id.(txt|srt|vtt|json)` → Ekspor transkrip

Contoh payload SSE

```json
{ "type":"status", "jobId":"...", "status":"transcribing" }
{ "type":"raw", "chunkIndex":3, "text":"..." }
{ "type":"quick", "chunkIndex":3, "text":"...", "provider":"router", "confidence":0.80 }
{ "type":"enhanced", "chunkIndex":0, "text":"...", "provider":"router", "confidence":0.85 }
{ "type":"done", "jobId":"..." }
```

Kunci Cache

- `COMMUNITY_CACHE:{audioHash}` → `{ text, corrections, contributor, upvotes }`
- `RESPONSE_CACHE:{sha256(audioHash|mode|sortedGlossary)}` → teks yang dikoreksi
- `QUOTA_COUNTERS:{provider}:minute:{YYYYMMDDHHmm}` → `{ used, limit }`
- `QUOTA_COUNTERS:{provider}:day:{YYYYMMDD}` → `{ used, limit, resetAt }`
- `METRICS:success|failure:{provider}:day:{YYYYMMDD}` → jumlah
- `JOB_STATE:{jobId}` → snapshot pekerjaan (potongan, updatedAt)

Kontribusi sangat diterima! Baik itu meningkatkan kode, menyarankan fitur, atau melaporkan bug, bantuan Anda sangat dihargai. Harap baca file `prd.md` dan `prd.yaml` untuk memahami visi dan detail teknis proyek sebelum berkontribusi.

## Lisensi

Proyek ini dilisensikan di bawah Lisensi MIT. Lihat file `LICENSE.md` untuk detailnya.
