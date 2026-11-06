# Kesiapan deploy Vercel Hobby

Target yang dipilih owner: Vercel Hobby untuk penggunaan pribadi. Model lokal, Hermes dan Telegram ditunda. Source website berada di **feat/tracker-core**; main masih checkpoint handoff dan belum di-merge. Build/CI lulus tidak berarti login live, backup atau seluruh PRD sudah siap.

## Hasil audit hosted

- Owner Auth terkonfirmasi, tidak dihapus/diblokir, dan cocok dengan satu profile owner.
- Keempat file migrasi lokal cocok dengan versi dan SHA-256 history hosted: core `20261105143738`, research `20261105143833`, agent_api `20261105154620`, lifecycle `20261105165019`. Jangan replay migrasi atau mengubah metadata history.
- Public Auth settings HTTP200: email aktif, autoconfirm false, anonymous auth false, **disable_signup false**. Owner pada 6 November 2026 secara eksplisit mengizinkan public signup tetap aktif; ini bukan blocker deploy. Aplikasi tetap membatasi akses tracker ke UUID owner existing dan tidak menyediakan provisioning tracker multi-user.
- Permintaan OTP sebelumnya diterima, tetapi delivery kode, template numerik, verifyOtp/sesi dan CRUD/export/logout menggunakan sesi owner hosted belum diverifikasi.
- Konfigurasi lokal memakai localhost; hanya OWNER_AUTH_USER_ID terikat ke runtime cloud. Konfigurasi Vercel belum dipasang dan URL deploy belum ditentukan. Pada 6 November 2026 owner mengonfirmasi project Vercel belum dibuat.
- CI pada `8a93dfa` berhasil; lihat release evidence untuk validasi kelanjutan ini. Tidak ada project/deployment Vercel yang dibuat dari audit ini.

## Konfigurasi yang sudah disiapkan

`vercel.json` memakai framework Next.js, `npm ci` dan `npm run build`; Node ditentukan **24.x** pada package/lockfile. Gunakan Node.js runtime; static export/GitHub Pages tidak mendukung cookie Auth dan API website ini. Tidak ada cron, model berbayar, worker provider, atau opsi paket berbayar yang ditambahkan.

`.vercelignore` mengecualikan file environment/private dan handoff historis dari upload melalui CLI. File schema bridge yang dipakai API tetap tersedia. Jangan menganggap ignore CLI sebagai jaminan source privat hilang dari repository/Git history atau build context integrasi Git; periksa juga file trace/output build. Tidak ada folder handoff yang dipindahkan ke `public/`.

Ekspor dibatasi 4 MiB sebelum respons dikirim, dengan `maxDuration=60` dan deadline database 45 detik. Ukuran lebih besar menghasilkan HTTP413 tanpa attachment parsial. Halaman dan API memakai private/no-store; Proxy mempertahankan header cache serta cookie chunks saat refresh Supabase. Header dasar menolak framing, menonaktifkan MIME sniffing dan menahan referrer. Logout melaporkan error ketika provider belum menerima sign-out.

`GET /api/health` hanya memeriksa proses/format konfigurasi: HTTP200 `status: ok` atau HTTP503 `setup_required`. Tidak mengirim UUID/email/key, tidak memanggil Auth dan tidak membuktikan database, SMTP, owner login, backup atau kesiapan rilis.

Dokumentasi Next.js terpasang dan Supabase SSR terkini sudah dibaca. URL dokumentasi batas Vercel `https://vercel.com/docs/functions/limitations` ditolak policy jaringan cloud saat audit; batas/fitur akun aktual tetap perlu dicek di Dashboard Vercel. Tidak ada upaya mengubah atau memublikasikan ulang policy environment untuk melewati pembatasan itu.

## Penyiapan saat deploy telah diotorisasi

1. Gunakan repository existing dan branch `feat/tracker-core`, root repository, preset Next.js, Node 24.x. Jangan mengimpor branch main sebagai source aplikasi saat ini. Tidak diperlukan merge main untuk memeriksa preview branch.
2. Di pengaturan environment Vercel, pasang lima variabel dari konfigurasi yang sudah ada melalui UI privat: APP_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, OWNER_AUTH_USER_ID, OWNER_EMAIL. Jangan menaruh service-role/secret key pada variabel publik. Jangan kirim key, email OTP atau link login lewat chat.
3. APP_URL harus origin HTTPS **persis yang dipakai browser**, tanpa path/query/credential. Atur Preview dan Production secara terpisah; jangan memakai origin Production untuk membuka Preview. Gunakan alias branch yang stabil untuk Preview atau URL exact deployment yang ditetapkan operator. App menolak mutation dari origin lain; tidak memakai header Host/X-Forwarded-Host sebagai identitas yang dipercaya.
4. Pertahankan `AI_PROVIDER=disabled` dan `INTEGRATION_WRITES_ENABLED=false`. Tidak perlu memindahkan HTTP_PROXY/CA dari cloud development ke Vercel. Tidak perlu key admin/service-role untuk CRUD website.
5. Public signup boleh aktif sesuai keputusan owner. Pastikan akun owner existing tetap tersedia dan template Magic Link memuat `{{ .Token }}`. Website memakai kode email, bukan callback 127.0.0.1. Atur Site URL Supabase sesuai origin tujuan. Akun Auth baru tidak otomatis mendapat profile atau akses tracker; RLS/UUID owner tidak diubah.
6. Preview terbatas dapat dipakai untuk smoke owner setelah otorisasi deploy dan konfigurasi. Pertahankan perlindungan akses Preview dari Vercel. Periksa pengaturan Git auto-deployment sebelum menghubungkan repository; push branch bukan otorisasi untuk merge/merilis Production.

## Preflight tanpa write

Dengan variabel sudah tersedia pada shell yang aman:

```sh
npm run deploy:check
```

Untuk konfigurasi lokal yang di-ignore:

```sh
node --env-file=.env.local scripts/deploy-check.mjs
```

Pada managed cloud Node 24, tambahkan `NODE_USE_ENV_PROXY=1` agar mengikuti proxy/CA existing. File lokal dengan APP_URL localhost sengaja menghasilkan blocked untuk deploy. Jangan mengganti file lokal menjadi domain kandidat hanya untuk meloloskan pemeriksaan. `--config-only` memeriksa format saja dan tidak menyentuh jaringan; CI memakai data sintetis.

Exit0 berarti **pemeriksaan otomatis yang dipilih lulus**, bukan persetujuan rilis. Exit1 berarti konfigurasi/Auth settings menghalangi; exit2 untuk argumen salah. Output hanya nama field/kode alasan, tanpa nilainya. Probe remote hanya GET public Auth settings, redirect ditolak, timeout 15 detik. Tidak ada email, login, token mint, migrasi atau domain write. Format publishable/legacy anon diperiksa; validasi bentuk JWT bukan pemeriksaan signature. Probe juga tidak dapat membuktikan sesi owner. Public signup dicatat sebagai enabled/disabled dan diterima; data settings yang hilang/rusak tetap menolak preflight. Anonymous login tetap nonaktif, email provider aktif dan email confirmation tetap diperlukan.

## Smoke dan gate penggunaan harian

Pada URL yang benar, periksa health lalu login melalui email owner dan kode numerik **di website**. Pastikan sesi bertahan saat refresh, capture/review/milestone/export/logout bekerja dengan data uji yang disetujui, dan akses setelah logout ditolak. Jangan memasukkan kode ke chat atau memakai data pribadi penting sebagai fixture. Simpan bukti deployment/commit dan hasil aktual; health/CI/mocks tidak menggantikan smoke ini.

Backup database serta isolated restore belum tersedia/teruji. Ekspor JSON sekarang mengecualikan state operasional privat dan tidak menyediakan restore otomatis. Jangan menjadikan deployment ini satu-satunya salinan data penting sebelum backup/restore ditetapkan. Google Calendar/Sheets, recurrence dan worker masih belum diimplementasikan; rilis terbatas harus menyebut batas fitur tersebut. Pilot Hermes/Telegram bukan gate website saat ini.

Audit ini tidak melakukan deploy, merge main, migrasi, perubahan Auth hosted, atau publish environment. URL/project Vercel dan verifikasi owner live masih perlu diselesaikan sebelum klaim siap harian.
