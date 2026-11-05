# Konfigurasi dan akses yang masih diperlukan

## Untuk memakai alur website live sekarang

Project development, publishable key dan email owner sudah dipulihkan ke `.env.local` yang di-ignore. Jaringan/OAuth MCP, UUID Auth terkonfirmasi, dua migrasi hosted dan singleton profile sudah diverifikasi pada 5 November 2026; lihat [status setup Supabase](SUPABASE_SETUP.md). Tidak perlu membuat project atau menerapkan migrasi ulang. Lima variabel konfigurasi referensi:

- APP_URL: origin canonical browser website.
- NEXT_PUBLIC_SUPABASE_URL: endpoint project development.
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable key, bukan service-role.
- OWNER_AUTH_USER_ID: UUID akun owner yang sudah diprovision.
- OWNER_EMAIL: email owner untuk OTP.

Public signup masih aktif dan perlu dinonaktifkan di Dashboard. Periksa template Magic Link agar memuat `{{ .Token }}`, lalu verifikasi delivery kode dan sesi login melalui website. Satu permintaan OTP sudah diterima HTTP 200; hasil itu belum membuktikan login penuh. Jangan kirim nilai secret, OTP atau tautan login di chat. Tidak perlu service-role key untuk CRUD website.

Runtime terbaru hanya menyediakan binding OWNER_AUTH_USER_ID. Konfigurasi aplikasi lainnya ada dalam file lokal yang di-ignore; file lokal dan OAuth tidak dijamin bertahan pada instance baru. Policy runtime sudah enforced dengan domain yang benar; environment tidak dipublikasikan ulang.

## Akses sumber live

Pada sesi implementasi ini tool GitHub/Google Drive/Calendar/Spreadsheets dan read_thread tidak diekspos, walaupun ditandai dalam pesan. Ini bukan bukti akun belum terhubung. Read-only Git melalui proxy native berhasil; main masih 83161ffd53d4dda2099790f966332dc7cd3058e3. Tidak ada token GitHub baru yang diperlukan untuk pemeriksaan tersebut. Branch feat/tracker-core sudah berhasil di-push atas permintaan owner; main tidak di-merge. CI pada commit 5d0e4a1 sudah diverifikasi Success melalui halaman Actions publik yang diizinkan; api.github.com tetap ditolak proxy.

Untuk pembacaan live nanti, tool sumber tersebut perlu tersedia pada sesi. Preview percakapan hanya konteks historis; bukan hasil verifikasi baru dan bukan seed produksi. Website tetap membutuhkan Google OAuth sendiri; koneksi ChatGPT bukan credential website. Google OAuth client/scopes, pilihan kalender, legacy cutover dan scheduler ditetapkan saat WP04, bukan dengan memberikan akses Calendar luas sekarang.

## Template dan pilot Hermes

Backend agent dan Settings credential sudah diuji lokal; migrasi `20261105154620_agent_api.sql` sudah diterapkan hosted dengan checksum dan ACL terverifikasi. Credential live/session dan restore tetap gate terpisah. Tinjau [API agent dan gate](AGENT_API.md) sebelum penerapan. Jangan memakai cookie owner, key Supabase atau grant nyata pada bridge sebelum gate hosted/restore selesai. Tidak diperlukan key baru lewat chat. Dua migrasi core/research existing tidak dijalankan ulang.

Owner memilih melanjutkan desain aplikasi sekarang dan menyesuaikan Analytics Dashboard ketika sumber templatenya dapat diakses. Template asli belum dibaca atau digunakan; ini bukan blocker backend.

Model lokal, Hermes dan Telegram ditunda atas arahan owner; kelanjutan website tidak bergantung pada pilot tersebut. Jika dilanjutkan nanti, Hermes tetap di Windows native, memakai model lokal dan anggaran API Rp0 tanpa cloud fallback. Pemilihan tag/model dan live bot dilakukan pada laptop owner saat WP08. Tidak ada bot, token, inferensi atau receiver Telegram yang dibuat dari pekerjaan ini.

## Pembaruan konfigurasi Supabase

Checkpoint sebelumnya terblokir proxy CONNECT 403. Instance terbaru sudah mencapai endpoint Supabase dan OAuth selesai. Setelah persetujuan owner, migrasi awal diterapkan sekali dan profile diprovision; nomor file lokal sekarang cocok dengan history hosted. Lihat docs/SUPABASE_SETUP.md dan release evidence sebelum melanjutkan. Pada cloud task baru pilih branch feat/tracker-core, lalu periksa policy, registrasi/auth MCP, konfigurasi lokal dan history aktual sebelum melakukan write.

Untuk membuka blokir proxy tanpa mengulang pemberian key, ikuti [panduan Environment dan task baru](CLOUD_NETWORK_TROUBLESHOOTING.md). Pemeriksaan `node scripts/cloud-network-check.mjs` tidak mengirim API key.
