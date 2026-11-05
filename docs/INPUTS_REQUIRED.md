# Konfigurasi dan akses yang masih diperlukan

## Untuk memakai alur website live sekarang

Owner perlu menyiapkan project Supabase development dan lima variabel di Environment Settings atau `.env.local` yang di-ignore:

- APP_URL: origin canonical browser website.
- NEXT_PUBLIC_SUPABASE_URL: endpoint project development.
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable key, bukan service-role.
- OWNER_AUTH_USER_ID: UUID akun owner yang sudah diprovision.
- OWNER_EMAIL: email owner untuk OTP.

Nonaktifkan public signup, provision satu profiles row, konfigurasi email OTP, dan terapkan dua migration sesuai README/RESEARCH_IMPORT. Izinkan hostname Supabase yang benar di network settings bila restricted. Jangan kirim nilai secret di chat. Tidak perlu service-role key untuk CRUD website.

Kelima requirement sudah disimpan pada draft environment dari tahap sebelumnya. Observasi runtime saat pekerjaan ini masih tidak memiliki binding variabel/secret aplikasi; menyimpan draft bukan bukti konfigurasi sudah diterapkan.

## Akses sumber live

Pada sesi implementasi ini tool GitHub/Google Drive/Calendar/Spreadsheets dan read_thread tidak diekspos, walaupun ditandai dalam pesan. Ini bukan bukti akun belum terhubung. Read-only Git melalui proxy native berhasil; main masih 83161ffd53d4dda2099790f966332dc7cd3058e3. Tidak ada token GitHub baru yang diperlukan untuk pemeriksaan tersebut. Tidak ada push atau perubahan remote.

Untuk pembacaan live nanti, tool sumber tersebut perlu tersedia pada sesi. Preview percakapan hanya konteks historis; bukan hasil verifikasi baru dan bukan seed produksi. Website tetap membutuhkan Google OAuth sendiri; koneksi ChatGPT bukan credential website. Google OAuth client/scopes, pilihan kalender, legacy cutover dan scheduler ditetapkan saat WP04, bukan dengan memberikan akses Calendar luas sekarang.

## Template dan pilot Hermes

Owner memilih melanjutkan desain aplikasi sekarang dan menyesuaikan Analytics Dashboard ketika sumber templatenya dapat diakses. Template asli belum dibaca atau digunakan; ini bukan blocker backend.

Hermes tetap di Windows native, memakai model lokal dan anggaran API Rp0 tanpa cloud fallback. Pemilihan tag/model dan live bot dilakukan pada laptop owner saat WP08. Tidak ada bot, token, inferensi atau receiver Telegram yang dibuat dari pekerjaan ini.
