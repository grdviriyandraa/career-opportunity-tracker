# Career Opportunity Tracker

Aplikasi pribadi Bahasa Indonesia untuk menyimpan peluang Jobs, Bootcamps dan Competitions. Implementasi awal menyediakan tujuh menu, email OTP owner, capture draft, daftar/pencarian, detail, update progres, arsip, milestone internal dan audit transaksional.

**Status:** fondasi dan alur inti sedang diuji. Impor manual dengan preview, riwayat riset per run, dan review field publik tersedia. Koneksi Google Calendar/Sheets, recovery, recurrence, agent API, MCP dan live Telegram belum tersedia. Baca [STATUS.md](STATUS.md). Source di `reference_partial_source/` adalah arsip parsial yang tidak runnable, bukan aplikasi ini.

## Menjalankan

Prasyarat: Node.js >=22.13 (diuji 24.22.1), npm. Gunakan checkout existing; cloud task sudah terisolasi dan tidak perlu worktree baru.

```sh
cd /workspace/career-opportunity-tracker
npm ci
cp .env.example .env.local
npm run dev
```

Jangan overwrite `.env.local` yang sudah ada. Aplikasi menampilkan panduan setup bila konfigurasi belum lengkap; tidak berpura-pura menyimpan draft atau memuat data pribadi contoh.

## Supabase dan owner

1. Buat project Supabase development terpisah dari produksi.
2. Jalankan semua file SQL dalam `supabase/migrations/` sesuai urutan nama melalui SQL editor/admin migration connection; lewati migrasi yang sudah diterapkan. Jangan memasukkan admin/database credentials ke browser.
3. Provision satu akun owner dari Supabase Dashboard. Nonaktifkan public signup. Catat UUID akun yang terverifikasi.
4. Dari SQL editor, provision profile (ganti placeholder dengan UUID akun tersebut):

   ```sql
   insert into public.profiles(owner_id) values ('OWNER_UUID_HERE'::uuid);
   ```

5. Atur template email login Supabase agar menampilkan `{{ .Token }}`. Alur aplikasi menggunakan kode email, bukan callback magic-link. Konfigurasikan pengiriman email dan rate limit provider; uji delivery sebelum dipakai harian.
6. Isi `.env.local`: `APP_URL` (origin canonical), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `OWNER_AUTH_USER_ID`, dan `OWNER_EMAIL`. Publishable key bukan service-role key. ID owner wajib sama dengan profile serta akun Auth.
7. Restart server. Login memakai email owner → kode email. Akun lain ditolak, walaupun memiliki sesi Supabase.

Supabase perlu dapat dijangkau melalui HTTPS oleh server. Dalam cloud dengan allowlist, tambahkan hostname project yang benar di environment settings setelah project dipilih. Tidak diperlukan akses Google untuk alur inti. Jangan kirim secrets di chat, commit `.env.local`, atau memakai database produksi pada tests.

## Verifikasi

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

`npm test` menguji schema/identity dan menjalankan migrasi, RLS, transaksi serta rollback pada PostgreSQL PGlite. Fixtures seluruhnya sintetis. Build membatasi worker ke dua; tidak memerlukan Google, bot, database live, atau font eksternal.

Browser tests, setelah build:

```sh
npx playwright install chromium
npm run test:e2e
npm run test:e2e:core
```

Jika Chromium sistem sudah tersedia, gunakan `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` pada Linux. Di Windows PowerShell, set `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` hanya bila memakai browser existing; jika tidak, gunakan browser yang dipasang Playwright.

- `test:e2e`: desktop + 390 px, setup yang jujur, navigasi, error dan penolakan API ketika belum dikonfigurasi.
- `test:e2e:core`: database sintetis terisolasi, mock transport Supabase Auth/PostgREST; login, capture, update, konflik revisi, milestone, dedup dan preservasi progres pada desktop + 390 px. Proses fixture hanya untuk test dan dihentikan runner. Tidak membuktikan email/Auth hosted live.
- Tests tidak menyentuh Google, Sheets, Telegram atau tracker pribadi.

## Struktur dan batas perilaku

- `app/`, `components/`: tujuh menu, detail, form dan cookie API.
- `lib/domain.ts`: strict schemas, identitas URL, tipe inti, interval overlap.
- `lib/server.ts`, `proxy.ts`: sesi, owner, origin, bounded request body dan refresh cookie.
- `supabase/migrations/`: schema, RLS, RPC transaksional.
- `tests/`: schema/database dan browser scenarios; `tests/support/` bukan runtime produksi.
- `docs/ADR-001.md`: keputusan dan batas validasi.
- `examples/`, `templates/`: bahan handoff; tidak otomatis diimpor menjadi data.

Capture tidak mengambil URL sumber. Draft tetap tersimpan dan diberi `manual_required`; tidak ada fetcher rentan SSRF atau klaim ekstraksi berhasil. URL kanonik menghapus parameter tracking yang dikenal, mempertahankan job IDs. Field personal tidak ditimpa duplicate capture. Applied memerlukan tanggal aktual; klik link tidak mengubah progres. Milestone hanya agenda internal dan tidak mempublikasikan event Google. Outbox tersimpan durable tetapi blocked sampai worker integrasi diimplementasikan.

## Operasi dan privasi

Stop dev/start dengan Ctrl-C; proses harus dijalankan ulang pada task baru. Database berada di Supabase, bukan snapshot filesystem cloud. Tidak ada backup terjadwal atau restore rehearsal yang diklaim; jangan pakai untuk satu-satunya salinan data penting sebelum WP05 selesai.

Dokumen historis pada root yang sudah ada sebelum implementasi dapat mengandung informasi pribadi. Jangan mem-publish ulang paket handoff mentah atau data tracker. Commit source baru secara selektif; jangan gunakan `git add .` tanpa review. Penghapusan dokumen dari commit baru tidak membersihkan riwayat Git existing.

Google OAuth, scheduler/cutover legacy, Sheets, agent grants/MCP, Windows Ollama dan bot private-owner mengikuti backlog berikutnya. Belum ada token agent atau koneksi eksternal yang dibuat; tidak ada deployment produksi, merge ke main, atau push otomatis.

## Riwayat riset

Inbox menyimpan snapshot immutable per run, membedakan baru/lama diperiksa/carry-forward, serta menampilkan waktu riset terpisah dari waktu impor. Overview memakai snapshot terakhir yang benar-benar tersimpan, bukan jumlah baris hasil pencarian. Impor JSON manual selalu melalui preview server-held; fakta sumber existing menjadi usulan dan progres pribadi dipertahankan. Review detail dapat menerapkan field publik terpilih dengan revision check.

Baca [format impor dan batasnya](docs/RESEARCH_IMPORT.md) serta [konfigurasi yang diperlukan](docs/INPUTS_REQUIRED.md). Paket sintetis hanya dipakai di tests; tidak ada data riset privat yang dimuat otomatis. Koneksi Google Sheets live dan penerapan koreksi run belum tersedia.
