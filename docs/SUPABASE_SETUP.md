# Supabase: aplikasi, MCP, dan owner

## Status setup saat ini — 5 November 2026

- Dua skill resmi `supabase/agent-skills` dipasang sebagai copy di `.agents/skills/` dengan CLI `skills@1.7.6`. `skills-lock.json` mencatat source dan hash. Skill sudah dibaca; tidak mengubah dependency aplikasi.
- Runtime terbaru running/connected dan policy restricted/enforced mengizinkan keempat host Supabase. Script diagnosis jaringan exit 0. Tidak perlu publish ulang environment.
- OAuth MCP read-only selesai. Owner kemudian menyetujui OAuth database write, penerapan dua migrasi existing dan provisioning profile. OAuth write tersebut juga selesai; tidak meminta API key melalui chat.
- Inspeksi awal menemukan satu akun Auth terkonfirmasi, tanpa tabel public atau migration history. Dua migrasi berhasil diterapkan sekali dan satu profile yang cocok dengan UUID owner terverifikasi dibuat. Owner melihat satu profile melalui simulasi role authenticated; UUID lain melihat nol.
- Versi hosted: `20261105143738_core` dan `20261105143833_research`. Nama file lokal diselaraskan dengan versi ini; checksum SQL tidak berubah. Jangan menjalankan ulang SQL memakai nama file lama. Metadata history hosted tidak diubah.
- `.env.local` yang di-ignore dipulihkan dari email akun Auth terkonfirmasi dan publishable key publik; UUID owner tersedia dari runtime. Tidak ada service-role key yang diperlukan atau ditampilkan.
- Website lokal dijalankan dengan `NODE_USE_ENV_PROXY=1 npm run start` pada Node 24 agar fetch Auth mengikuti proxy/TLS environment. Satu permintaan OTP owner diterima HTTP 200. Email delivery, template kode angka, verifikasi kode dan sesi website belum dibuktikan.
- Pengaturan Auth publik menunjukkan signup masih aktif. Matikan public signup pada Dashboard sebelum acceptance owner-only. Bila email hanya memuat tautan, ubah template Magic Link agar memuat `{{ .Token }}`; jangan membagikan OTP atau tautan login ke chat.
- Advisors memperingatkan enam fungsi SECURITY DEFINER yang sengaja menjadi API transaksi serta leaked-password protection disabled. Anonymous EXECUTE ditolak, search_path kosong dan guards owner diperiksa; warning tetap dicatat, bukan dinyatakan hilang. Lihat release evidence.

Project reference dan email sebenarnya hanya berada dalam konfigurasi lokal/draft, bukan contoh publik dokumen ini. Region yang diberikan owner belum diverifikasi melalui API.

## Empat jenis akses yang berbeda

| Akses                                      | Dipakai untuk                                          | Bukan pengganti               |
| ------------------------------------------ | ------------------------------------------------------ | ----------------------------- |
| Publishable key                            | Client/data API; dipasangkan dengan sesi user dan RLS  | Admin SQL atau OAuth MCP      |
| Secret key aplikasi                        | Operasi server istimewa bila benar-benar diperlukan    | Management API/MCP login      |
| OAuth MCP atau scoped Management API token | Tool administratif Supabase sesuai project/permissions | Sesi login owner pada website |
| Password/koneksi PostgreSQL                | Migrasi/admin database melalui koneksi yang sah        | Login browser aplikasi        |

CRUD aplikasi tidak memerlukan secret key/service-role. Secret key yang dibagikan lewat chat perlu dicabut/dirotasi di dashboard API Keys; jangan kirim penggantinya di chat. Tidak perlu membuat key server baru hanya untuk menjalankan CRUD ini.

Panduan panel Environment, diagnosis tanpa key dan langkah jika task tetap memakai versi lama ada di [CLOUD_NETWORK_TROUBLESHOOTING.md](CLOUD_NETWORK_TROUBLESHOOTING.md).

## Langkah untuk membuka blocker jaringan

Domain yang sudah disimpan ke draft Environment Settings:

- Host project: `<PROJECT_REF>.supabase.co`.
- `mcp.supabase.com`.
- `api.supabase.com`.
- `supabase.com` (OAuth/dashboard/dokumentasi).

Owner sudah melaporkan pengaturan dilakukan. Tidak perlu mengulang penyimpanan hanya karena instance lama masih memakai policy lama. Buka cloud task baru dengan branch feat/tracker-core, lalu periksa environment_status dan policy aktual. Preset package-manager dan domain existing dipertahankan; tidak ada wildcard. Setelah konfigurasi runtime aktif, ulangi pemeriksaan read-only tanpa bypass proxy atau mematikan TLS verification.

## MCP Codex

Perintah registrasi, jika belum ada:

```sh
codex mcp add supabase --url 'https://mcp.supabase.com/mcp?project_ref=PROJECT_REF&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching%2Cfeedback'
codex mcp login supabase
```

Ganti `PROJECT_REF` dengan project yang diberikan owner. Kutip seluruh URL karena mengandung `&`. Jangan menimpa server existing yang ternyata menunjuk project lain tanpa memeriksa konteks.

Untuk lingkungan headless, CLI yang terpasang mendukung `codex mcp login supabase --no-browser`. Ikuti flow browser dari CLI pada instance yang sama. Login pada laptop/instance lain tidak otomatis memberi credential ke cloud ini. Secret key aplikasi tidak boleh dipasang sebagai bearer token MCP.

Browser laptop dapat berhenti pada `127.0.0.1:<port>/callback` dengan connection refused karena CLI berada di cloud. Jangan refresh atau mengulangi OAuth; URL callback dari flow yang sama harus diteruskan ke prompt `Callback URL (input hidden)` CLI cloud. Tekan Enter setelah menempelkannya. Callback merupakan kode sekali pakai; jangan commit/simpan ke dokumen, dan jangan sertakan access token atau API key. Login baru hanya diperlukan bila flow lama sudah kedaluwarsa.

`/mcp` adalah perintah antarmuka Codex, bukan perintah Bash. Setelah OAuth selesai, refresh koneksi MCP dan pastikan tools terlihat. Registrasi server saja tidak membuktikan koneksi/auth siap. OAuth credential dan konfigurasi global tidak diasumsikan pulih pada task baru; startup instructions sudah mencatat verifikasi registrasi.

## Login owner dan database website

1. Setelah akses MCP/admin tersedia, inspeksi project, tabel, user Auth, dan migration history. Jangan mengasumsikan database kosong atau menjalankan ulang migrasi yang sudah diterapkan.
2. Terapkan dua migrasi existing secara terkontrol dan transactional sesuai workflow Supabase yang terverifikasi. Baca skill Supabase, changelog dan docs terkini; jalankan advisors untuk perubahan schema/security. Tidak ada schema baru yang diterapkan pada pekerjaan konfigurasi ini.
3. Nonaktifkan public signup. Provision akun owner melalui Authentication dan verifikasi email. Ambil **User UID (UUID)** dari akun tersebut; email/project ref bukan UUID owner.
4. Pastikan hanya owner yang dimaksud ada pada `public.profiles`. Bootstrap berikut hanya setelah memeriksa owner/migration yang sudah ada:

   ```sql
   insert into public.profiles(owner_id)
   select id from auth.users
   where id = 'OWNER_UUID'::uuid and email_confirmed_at is not null
   on conflict (owner_id) do nothing;
   ```

   Nol baris berarti akun/konfirmasi belum cocok; jangan menganggap provisioning berhasil. Constraint singleton mencegah owner kedua.

5. Isi `OWNER_AUTH_USER_ID` pada `.env.local`/environment settings dengan UUID yang terverifikasi. URL project, publishable key dan email sudah disiapkan lokal; periksa nama/presence tanpa mencetak nilainya.
6. Atur template email login Supabase untuk menampilkan `{{ .Token }}`. Restart aplikasi, login melalui email owner, lalu uji simpan/edit dan akses tanpa sesi. Jangan menganggap OTP delivery atau RLS hosted lulus dari mock tests.

Data API dapat aktif, tetapi tabel tetap memerlukan explicit grants dan RLS. Jangan memberi semua role hak tulis sebagai cara mengatasi error. Migrations existing membatasi SELECT ke authenticated owner dan mutation melalui fungsi transaksi dengan owner/revision guards; verifikasi lagi menggunakan advisors dan negative access tests pada hosted project.

## Bukti dan batas verifikasi

Koneksi live/OAuth, kedua migrasi dan owner/profile sudah diverifikasi pada instance terbaru. Changelog dan panduan OTP resmi dibaca. HTTP 200 pada permintaan OTP hanya membuktikan permintaan diterima provider; belum membuktikan delivery atau sesi login. Signup/template perlu ditinjau pada Dashboard. Tidak ada real tracker data atau synthetic seed yang dimasukkan ke project live.
