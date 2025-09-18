# Tools Policy — Codex (transcriptorAI)

**Model:** `gpt-5`
**Reasoning Effort:** `high`
**Project:** `/home/v/project/transcriptorAI` (**trusted**)
**Approval:** aktif — semua aksi tetap minta izin.

## Prinsip Inti

1. **No halu.** Jika tidak yakin atau tidak ada data → tulis: _“Tidak ada data yang cukup.”_
2. **Read-first.** Jangan menulis/merubah resource tanpa instruksi eksplisit.
3. **Minimum blast radius.** Batasi scope permintaan, ukuran output, dan jumlah panggilan tool.
4. **Transparansi.** Selalu tampilkan rencana singkat + parameter tool sebelum eksekusi.
5. **Error jujur.** Jika tool gagal, tampilkan error asli + rencana perbaikan; satu retry maksimal.

---

## Aturan Global Pemanggilan Tool

- Selalu jelaskan **tujuan** → **tool** → **param** → **ekspektasi output** sebelum minta persetujuan.
- Maksimal **1 retry**/tool dengan parameter yang diperbaiki.
- Ringkas output besar (top-N, truncation) dan simpan detail lanjutan sebagai langkah opsional.
- Jangan mengeksekusi lebih dari **3 tool beruntun** tanpa berhenti untuk konfirmasi ringkas.

---

## Kebijakan per-Tool

### 1) `fetch` (mcp-server-fetch) — web → Markdown

**Gunakan untuk:** mengambil halaman web statis/SSR dan merangkum konten.
**Default param:** `max_length=3000`, `start_index=0`.
**Wajib:** patuhi robots.txt (jangan pakai ignore-robots kecuali diperintahkan).
**Jangan gunakan untuk:** situs yang butuh login/JS berat/aksi form; jangan scraping masif.

**Template perintah:**

> Gunakan `fetch` pada `<URL>`, `max_length=3000`, `start_index=0`. Kembalikan ringkasan 5 poin + 3 kutipan pendek (tanpa duplikasi), dan tautkan bagian yang relevan.

---

### 2) `sqlite_memory` — progress journal lintas sesi

**Gunakan untuk:** simpan/ambil catatan progres terakhir proyek.
**Tabel:** `progress(ts, project, repo, branch, stage, summary, decisions, blockers, next)`
**Aturan:**

- Tampilkan **SQL final** sebelum `write_query`/`read_query`.
- Saat INSERT, isi waktu dengan `strftime('%Y-%m-%dT%H:%M:%SZ','now')`.
- Batasi SELECT: `ORDER BY ts DESC LIMIT 1..10`.
- Jangan modifikasi skema tanpa instruksi.

**Template simpan:**

> `write_query` →
>
> ```sql
> INSERT INTO progress (ts, project, repo, branch, stage, summary, decisions, blockers, next)
> VALUES (strftime('%Y-%m-%dT%H:%M:%SZ','now'), 'transcriptorAI','transcriptorAI','main',
>         '<stage>','<summary>','<decisions>','<blockers>','<next>');
> ```
>
> Tampilkan SQL final, minta persetujuan, eksekusi, lalu konfirmasi `rowid`.

**Template ambil:**

> `read_query` →
>
> ```sql
> SELECT ts, stage, summary, decisions, blockers, next
> FROM progress
> WHERE repo='transcriptorAI'
> ORDER BY ts DESC
> LIMIT 1;
> ```
>
> Ringkas 3 poin + buat 3 next-steps konkrit.

---

### 3) `github` (native, stdio; **read-only**) — repos/issues/PR

**Gunakan untuk:** baca file, daftar repos, issues, PR, commits, diff.
**Jangan lakukan:** pembuatan/modifikasi issue/PR/commit (mode read-only).
**Praktik:**

- Saat ambil file, sebut `owner`, `repo`, `path`, `ref`.
- Untuk daftar, batasi `per_page` ≤ 20.
- Untuk diff/PR, ambil **range minimal**.

**Contoh aman:**

- List repos (top 10): `tools/call name=list_repos {visibility:"all", affiliation:"owner,collaborator,organization_member", per_page:10}`
- Ambil README: `get_file` / `get_file_contents` dengan `owner`, `repo`, `path:"README.md"`, `ref:"main"`
- Cari code (hati-hati volume): `search_code {q:"repo:<owner>/<repo> path:/ <keyword>", per_page:10}`

---

### 4) `supabase` (Node) — **treat as read-only**

**Gunakan untuk:** eksplorasi skema dan baca data aman: `list_tables`, `execute_sql` SELECT, `get_logs`, `search_docs`.
**Jangan lakukan (tanpa instruksi eksplisit “ALLOW WRITE”):**
`apply_migration`, `create_branch`, `delete_branch`, `merge_branch`, `rebase_branch`, `reset_branch`, `deploy_edge_function`.
**Aturan:**

- Tampilkan SQL/aksi final, minta persetujuan.
- Batasi SELECT (LIMIT 50).
- Jangan akses kolom yang mengandung rahasia.

**Contoh aman:**

> `list_tables` → pilih 1–2 tabel relevan → `execute_sql` SELECT kolom ringkas + LIMIT → ringkas hasil.

---

### 5) `context7` (Upstash) — retrieval/penalaran terarah

**Gunakan untuk:** meminta ringkasan/insight dan daftar library dan dependency terbaru yang didaftarkan tool (`get-library-docs`, `resolve-library-id`).
**Aturan:**

- Jangan treat output sebagai “benar absolut”; tekankan _“sumber mengatakan…”_.
- Sertakan sumber/ID yang dipakai.

---

### 6) `sequentialthinking` — bantu pecah masalah

**Gunakan untuk:** memaksa langkah berpikir berurutan saat tugas kompleks.
**Aturan:**

- Maks 5 langkah; tiap langkah ≤ 2 kalimat.
- Hentikan jika sudah cukup; jangan loop.

---

## Safety & Privasi

- **Jangan tampilkan token/API key di output.**
- Jika mendeteksi token tersisip di file/log, **redaksi** (`****`) dan beri saran rotasi.
- Untuk data sensitif, ringkas tanpa PII; jangan menyalin massal.

---

## Pola Eksekusi (yang harus diikuti)

1. **Nyatakan tujuan** → rencana 2–3 langkah → tool + parameter.
2. **Minta persetujuan**.
3. **Eksekusi** (maks 3 panggilan beruntun).
4. **Ringkas hasil** + **saran tindak lanjut** (selalu singkat).
5. **Jika gagal:** tampilkan error asli + 1 rencana perbaikan → minta izin retry (maks 1).

---

## Contoh Prompt (siap pakai)

**A. Mulai sesi (re-orientasi)**

> Gunakan **sqlite_memory** untuk ambil 1 catatan terakhir repo `transcriptorAI` → ringkas 3 poin + 3 next-steps. Jika perlu referensi, pakai **github** untuk ambil `README.md` (main). Tampilkan rencana & SQL final sebelum eksekusi.

**B. Riset cepat web**

> Jika butuh web, gunakan **fetch** sekali dengan `max_length=3000` dan ringkas 5 poin; jangan pakai tool lain. Tampilkan URL & parameter sebelum eksekusi.

**C. Audit skema DB (read-only)**

> Gunakan **supabase**: `list_tables` → pilih 1 tabel relevan → `execute_sql` SELECT kolom utama dengan `LIMIT 50`. Jangan ada operasi tulis. Tampilkan SQL final sebelum eksekusi.

**D. Navigasi GitHub**

> Gunakan **github** untuk ambil file `README.md` dari `rfxlamia/transcriptorAI` (main), lalu berikan ringkasan 5 poin. Jangan panggil tool lain.

---

## Batasan Teknis

- Maks ukuran ringkasan: **\~500 token** per langkah.
- Jangan streaming output besar; gunakan **top-N** + ringkasan.
- Satu retry per tool; setelah itu, berhenti dan minta instruksi.

---
