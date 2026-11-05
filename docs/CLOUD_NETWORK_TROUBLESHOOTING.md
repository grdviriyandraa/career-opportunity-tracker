# Membuka akses Supabase pada Codex cloud

Checkpoint terbaru 5 November: jaringan sudah terbuka pada instance baru; diagnosis exit 0, OAuth selesai, migrasi awal dan owner/profile sudah diverifikasi. Tidak perlu publish ulang environment. Uraian blokir di bawah adalah bukti historis; lihat [status setup terkini](SUPABASE_SETUP.md) untuk gate OTP dan signup yang tersisa.

Pemeriksaan 5 November 2026 menunjukkan task ini masih memakai policy runtime revision 1, mode restricted/enforced, tanpa custom allowed hosts. File policy lokal juga belum mencantumkan host Supabase. Pengaturan yang sudah disimpan owner tidak otomatis membuktikan task lama memakai versi tersebut. Ini tidak membuktikan owner belum menyimpan atau project Supabase bermasalah. Diagnosis langsung dengan script di bawah menghasilkan `PROXY_CONNECT_403` pada keempat tujuan; exit 1 memang menandakan pemeriksaan jaringan gagal.

## Langkah di panel Environment

1. Buka **Environment** untuk task/repository yang dipakai menjalankan `career-opportunity-tracker`. Pastikan pengaturan yang dibuka milik environment yang dipilih task ini, bukan editor dari task lain.
2. Pada **Public internet access**, pertahankan **Enable package manager domains**. Buka ikon pensil **Additional allowed domains**.
3. Pertahankan domain existing dan pastikan empat hostname berikut ada, masing-masing tanpa `https://`, path, port atau query:

   ```text
   <PROJECT_REF>.supabase.co
   mcp.supabase.com
   api.supabase.com
   supabase.com
   ```

   Ganti `<PROJECT_REF>` dengan project reference existing dari dashboard Supabase. Tidak perlu membuat project, password database atau API key baru untuk memperbaiki blokir jaringan.

4. Jika ada perubahan yang belum disimpan, simpan pada editor. **All changes saved / Save draft** menyatakan konfigurasi tersimpan; **Publish** menerbitkan versi environment. Pada layar onboarding, **Save and publish** dapat mewakili alur tersebut. Tunggu proses selesai bila UI masih **Preparing your environment**. Jangan menganggap publikasi selesai dari tombol yang masih nonaktif.
5. Jika konfigurasi tersebut sudah disimpan dan dipublikasikan, lewati pengulangan langkah publikasi. Karena task ini masih melaporkan policy lama, buka **cloud task baru**, pilih repository yang sama, branch **`feat/tracker-core`**, dan environment yang baru diterbitkan. Main belum berisi implementasi aplikasi terbaru.
6. Pada task baru, minta Codex memeriksa policy aktual sebelum mengulang OAuth atau migrasi. Jangan berikan ulang nilai API key di chat.

Pilihan **Enable all public internet access** tidak diperlukan untuk empat host ini. Bila owner sengaja mengaktifkannya sebagai diagnosis sementara, itu tetap perubahan konfigurasi yang harus aktif pada runtime yang benar; tidak memperbaiki task yang masih terikat versi lama dengan sendirinya. Allowlist empat host adalah konfigurasi yang lebih terbatas untuk pekerjaan ini.

## Pesan siap kirim pada task baru

```text
Lanjutkan repository ini pada branch feat/tracker-core. Periksa environment_status:
observations_current, source config/version, spec_revision dan network_policy.
Pastikan policy enforced mengizinkan empat host Supabase yang disimpan.
Uji keterjangkauan MCP tanpa mengirim secret. Jika jaringan terbuka, lanjutkan
OAuth MCP pada instance ini, inspeksi project dan migration history, lalu verifikasi
owner Auth UUID/profile serta konfigurasi OTP. Jangan mengulang migrasi yang sudah
ada atau membuat project baru. Baca STATUS.md dan docs/SUPABASE_SETUP.md.
```

## Cara membedakan jaringan dan autentikasi

Jalankan pemeriksaan ringkas dari root repository setelah policy runtime berubah:

```sh
node scripts/cloud-network-check.mjs
```

Script membaca hanya URL project publik dari process/`.env.local`, memakai proxy yang diwariskan dan tidak mengirim API key. Hasil reachability bukan bukti authorization. Exit 0 berarti semua target menghasilkan respons HTTP yang dapat dinilai (bukan bukti layanan sehat/login berhasil); exit 1 menandakan transport gagal atau HTTP 403 yang belum dapat dipastikan; exit 2 berarti URL project belum tersedia sehingga pemeriksaan hanya sebagian. Script memerlukan `curl` di PATH; raw stderr, key dan URL project sebenarnya tidak dicetak. Codex juga dapat memeriksa endpoint MCP tanpa credential:

```sh
curl --disable --max-time 20 --silent --show-error --output /dev/null --write-out '%{http_code}\n' https://mcp.supabase.com/mcp
```

| Hasil | Artinya | Tindakan berikutnya |
| --- | --- | --- |
| Proxy `CONNECT ... 403` | Proxy cloud menolak tujuan sebelum autentikasi Supabase | Periksa environment/version/policy yang sedang dipakai; mengganti key tidak menyelesaikannya |
| HTTP `401` dari endpoint MCP | Endpoint dapat dijangkau, tetapi request belum memiliki autentikasi | Jalankan flow OAuth MCP pada instance ini |
| Respons lain dari server Supabase | Jalur mencapai server, tetapi respons tersebut belum membuktikan izin/project siap | Periksa status/body yang disanitasi; jangan menganggap semua `403` sebagai error proxy |
| Timeout/DNS/TLS error | Gangguan konektivitas yang berbeda | Catat error spesifik; pertahankan proxy dan TLS verification |

Registrasi server MCP bukan autentikasi. Setelah jaringan terbuka, ikuti `codex mcp login supabase` sesuai CLI yang terpasang; varian headless yang telah diperiksa adalah `--no-browser`. Login pada laptop atau instance lain tidak otomatis memberi akses ke cloud ini. Secret key aplikasi bukan token OAuth MCP. User UID owner dan pengiriman OTP adalah pemeriksaan terpisah setelah koneksi tersedia; lihat [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Bila task baru tetap memakai policy lama

Jangan mengulang penyimpanan yang sama tanpa diagnosis. Kumpulkan bukti berikut untuk laporan dukungan produk atau pemilik konfigurasi:

- Waktu pemeriksaan UTC dan nama environment yang dipilih di UI.
- Nama repository/branch serta bukti versi environment sudah diterbitkan.
- `source_config_id`, `source_config_version_id`, `spec_revision`, `observed_spec_revision`, `observations_current` dan state policy dari `environment_status`.
- Daftar hostname yang diharapkan dibandingkan `allowed_hosts` aktual; bila mode unrestricted, periksa mode/state tersebut pula.
- Error request yang disanitasi, misalnya `CONNECT 403`, tanpa token, cookie atau nilai environment.

Jika source config berbeda dari environment yang dipilih, periksa pemilihan environment/task. Jika source config sama tetapi versi/policy tidak berubah setelah publikasi dan task baru, laporkan ketidaksesuaian aktivasi tersebut. Tool yang tersedia pada sesi ini hanya membaca status atau menyimpan draft/metadata; tidak menyediakan restart, reconnect, apply runtime atau publish. Tidak ada perintah shell yang dapat mengganti policy sidecar. Jangan menghapus proxy, mengedit file policy untuk membuka akses, atau mematikan verifikasi TLS.

Dokumen ini tidak membuktikan OAuth, database, OTP, Google maupun Telegram live sudah siap. Tidak ada perubahan konfigurasi atau request bercredential yang dijalankan saat menulis panduan ini.
