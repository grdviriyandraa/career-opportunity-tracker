# Career Opportunity Tracker

Aplikasi pribadi Bahasa Indonesia untuk menyimpan peluang Jobs, Bootcamps dan Competitions. Implementasi awal menyediakan tujuh menu, email OTP owner, capture draft, daftar/pencarian, detail, update progres, arsip, milestone internal dan audit transaksional.

**Status:** fondasi dan alur inti sedang diuji. Impor manual dengan preview, snapshot immutable, review field publik dan Agenda internal tersedia. Backend agent baca/draft, Settings credential dan bridge MCP diuji bersama melalui transport sintetis; migrasi agent sudah diterapkan hosted, credential live dan sesi OTP belum diuji. Koneksi Google Calendar/Sheets, recovery, recurrence dan live Telegram belum tersedia. Baca [STATUS.md](STATUS.md). Source di `reference_partial_source/` adalah arsip parsial yang tidak runnable, bukan aplikasi ini.

## Menjalankan

Prasyarat: Node.js **24.x** (diuji 24.22.1; `.nvmrc`), npm. Gunakan checkout existing; cloud task sudah terisolasi dan tidak perlu worktree baru.

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

Checkpoint hosted 5 November: core, research, agent API, milestone lifecycle dan singleton profile owner sudah diterapkan serta diverifikasi. Nama file mengikuti history MCP (`20261105143738_core`, `20261105143833_research`, `20261105154620_agent_api`, `20261105165019_milestone_lifecycle`); isi SQL cocok dengan checksum yang disetujui. Jangan menerapkan ulang migrasi pada project existing. OTP request sudah diterima, tetapi delivery/session dan penutupan public signup masih menjadi gate. Detail di [SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md). Pada managed cloud Node 24, gunakan `NODE_USE_ENV_PROXY=1 npm run dev` atau `NODE_USE_ENV_PROXY=1 npm run start` agar fetch mengikuti proxy dan CA yang diwariskan; tidak perlu mengubah policy environment.

## Verifikasi

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

`npm test` menguji schema/identity dan menjalankan migrasi, RLS, transaksi serta rollback pada PostgreSQL PGlite. Fixtures seluruhnya sintetis. Build membatasi worker ke dua; tidak memerlukan Google, bot, database live, atau font eksternal.

Perintah standar memakai satu worker Vitest untuk membatasi resource PostgreSQL WASM; tidak perlu menambah `--maxWorkers=1`. CI menjalankan test dengan `umask 022`. Fixture MCP mengikuti startup produksi dengan membuat file ledger privat sebelum SQLite membukanya; guard tetap menolak credential/ledger dengan izin terbuka. Mode `022` dan `077` sama-sama diuji.

Browser tests, setelah build:

```sh
npx playwright install chromium
npm run test:e2e
npm run test:e2e:core
```

Jika Chromium sistem sudah tersedia, gunakan `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` pada Linux. Di Windows PowerShell, set `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` hanya bila memakai browser existing; jika tidak, gunakan browser yang dipasang Playwright.

- `test:e2e`: desktop + 390 px, setup yang jujur, navigasi, error dan penolakan API ketika belum dikonfigurasi.
- `test:e2e:core`: database sintetis terisolasi, mock transport Supabase Auth/PostgREST; login, capture, update, konflik revisi, milestone, dedup, preservasi progres, impor/review riset dan Agenda pada desktop + 390 px. Proses fixture hanya untuk test dan dihentikan runner. Tidak membuktikan email/Auth hosted live.
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

Target hosting dipilih Vercel Hobby. Konfigurasi build dan preflight tersedia; kesiapan penggunaan live masih memerlukan signup ditutup, origin HTTPS tujuan dan verifikasi OTP/sesi owner. Ikuti [panduan deploy Vercel dan gate aktual](docs/VERCEL_DEPLOYMENT.md). Environment cloud development tidak perlu dipublikasikan ulang.

Stop dev/start dengan Ctrl-C; proses harus dijalankan ulang pada task baru. Database berada di Supabase, bukan snapshot filesystem cloud. Tidak ada backup terjadwal atau restore rehearsal yang diklaim; jangan pakai untuk satu-satunya salinan data penting sebelum WP05 selesai.

Dokumen historis pada root yang sudah ada sebelum implementasi dapat mengandung informasi pribadi. Jangan mem-publish ulang paket handoff mentah atau data tracker. Commit source baru secara selektif; jangan gunakan `git add .` tanpa review. Penghapusan dokumen dari commit baru tidak membersihkan riwayat Git existing.

Google OAuth, scheduler/cutover legacy, Sheets, pilot Windows Ollama dan bot private-owner mengikuti backlog berikutnya. Grant/API agent dan MCP diuji lokal; tidak ada credential agent nyata, deployment produksi, merge ke main atau push otomatis.

## Riwayat riset

Inbox menyimpan snapshot immutable per run, membedakan baru/lama diperiksa/carry-forward, serta menampilkan waktu riset terpisah dari waktu impor. Overview memakai snapshot terakhir yang benar-benar tersimpan, bukan jumlah baris hasil pencarian. Impor JSON manual selalu melalui preview server-held; fakta sumber existing menjadi usulan dan progres pribadi dipertahankan. Review detail dapat menerapkan field publik terpilih dengan revision check.

Baca [format impor dan batasnya](docs/RESEARCH_IMPORT.md) serta [konfigurasi yang diperlukan](docs/INPUTS_REQUIRED.md). Paket sintetis hanya dipakai di tests; tidak ada data riset privat yang dimuat otomatis. Koneksi Google Sheets live dan penerapan koreksi run belum tersedia.

Setup Supabase untuk checkpoint saat ini sudah dimulai: lihat [status MCP, jaringan dan owner](docs/SUPABASE_SETUP.md). Project tidak perlu dibuat ulang; registrasi MCP belum setara OAuth atau database live yang siap.

## Agenda internal

Buka Agenda untuk memilih tanggal mulai, rentang 1–180 hari dan buffer sebelum/sesudah. Acara dengan jam pasti dapat menghasilkan bentrok pasti; tanggal saja atau kehadiran bersyarat menghasilkan potensi bentrok. Deadline memiliki peringatan kedekatan tersendiri dan tidak dihitung sebagai durasi kerja. Cakupan internal dan keterbatasan kalender eksternal selalu ditampilkan. Pembacaan bertahap mencakup lebih dari 1.000 milestone; batas atau perubahan jumlah data saat pemeriksaan diberi peringatan. Lihat [aturan dan batas Agenda](docs/AGENDA.md).

Detail peluang kini menyediakan edit, pembatalan dan pemulihan milestone dengan guard revisi peluang + milestone. Milestone dibatalkan tetap memiliki riwayat dan dapat dipulihkan; dikecualikan dari Agenda aktif serta deadline agent. [Migrasi lifecycle dan batas Google](docs/MILESTONES.md) sudah diterapkan hosted setelah persetujuan owner; jangan replay empat migrasi existing. Website belum di-deploy dan sesi owner hosted masih perlu diuji.

Source terbaru ada di branch `feat/tracker-core` yang sudah di-push atas permintaan owner. Pilih branch tersebut saat membuka cloud task baru; main belum di-merge.

## Ekspor data owner

Settings menyediakan unduhan JSON untuk sembilan tabel aplikasi, termasuk peluang arsip, milestone dibatalkan, seluruh history dan data riset. Manifest versi dan checksum disertakan; error atau pembacaan tidak lengkap membatalkan unduhan. File mengandung data pribadi. Ekspor bertahap ini belum merupakan backup database atau format restore lengkap; lihat [isi, checksum dan batas ekspor](docs/OWNER_EXPORT.md).

Model lokal, Hermes dan Telegram ditunda atas arahan owner; pengembangan website dapat berlanjut tanpa ketiganya. Kode agent/bridge existing tetap tersedia sebagai fitur opsional.

## Bridge MCP lokal untuk Hermes

`npm run build:mcp` membangun CLI stdio dengan empat tool read/draft sesuai kontrak. `npm test` juga membangun bridge sebelum menguji adapter dengan HTTP sintetis dan SDK client nyata. Bridge diuji pada Node 24; runtime ini menyediakan SQLite lokal untuk ledger intent. Baca [konfigurasi dan batas bridge](docs/MCP_BRIDGE.md).

Backend WP06 menyediakan empat `/api/agent/*` endpoint dan penerbitan/revocation credential di Settings setelah migrasi agent diterapkan. Baca [API agent dan gate hosted](docs/AGENT_API.md). Gunakan token khusus agent; cookie website dan key Supabase bukan credential bridge. Config `examples/hermes.config.example.yaml` adalah proposal handoff historis; variabel bridge aktual ada pada panduan baru. Hermes Windows, model lokal dan Telegram tetap perlu uji terpisah.

Untuk blokir jaringan cloud, ikuti [langkah Environment dan diagnosis tanpa key](docs/CLOUD_NETWORK_TROUBLESHOOTING.md). Perintah `node scripts/cloud-network-check.mjs` membedakan penolakan proxy dari respons HTTP tanpa mencetak konfigurasi privat.
