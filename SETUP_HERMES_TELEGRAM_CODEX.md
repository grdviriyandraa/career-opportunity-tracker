# Panduan Koneksi Hermes Telegram dan Codex di Windows

Versi 3.2 | 5 November 2026 | Panduan untuk Gerard | Jalur: Windows native, laptop dahulu, bot baru.

## Hasil yang dituju

Kamu dapat bertanya melalui Telegram, membaca peluang dan deadline di tracker, lalu menyimpan link ke Inbox website. Codex membangun website dan adapter MCP. Hermes tidak perlu memanggil Codex; keduanya memiliki tugas dan login terpisah. Langkah 1–6 menyiapkan percakapan umum. Langkah 7–11 menghubungkan tracker setelah kode yang diperlukan sudah dibuat.

Panduan ini belum dijalankan pada laptopmu. Nama endpoint, script build bridge dan menu website adalah deliverable untuk Codex. Jika file/script belum ada, selesaikan paket tugas terkait; jangan memasang paket dengan nama tebakan. Catat versi sebenarnya di templates/RELEASE_EVIDENCE.md. Dokumentasi resmi dan tanggal pemeriksaan ada pada SOURCES_AND_VERSION_NOTES.md.

## 0 Persiapan dan keputusan terbuka

Siapkan akun Telegram, akses GitHub repo, Codex, serta koneksi internet. Jangan kirim token atau password di chat. Windows tanpa WSL sudah dikonfirmasi. Native Windows menjadi jalur utama; WSL hanya alternatif jika ada kegagalan kompatibilitas yang terbukti.

| Keputusan | Status | Kapan perlu ditentukan |
|---|---|---|
| Inferensi Hermes | Lokal pada laptop Windows, Ollama sebagai runtime usulan | Pilih tag berdasarkan uji pada langkah 3 |
| Tagihan API model | Rp0, tanpa fallback cloud | Buktikan melalui H19 |
| Hosting website dan database | Belum final | Backend lokal dapat dipakai dahulu; hosting untuk penggunaan di luar laptop |
| Google Cloud OAuth dan kalender | Belum dikonfigurasi pada pekerjaan ini | Sebelum gate Google live |
| Nama bot | Bebas dipilih saat dibuat | Langkah 4 |

Telegram memerlukan internet; inferensi model berlangsung di laptop. Biaya API Rp0 berlaku untuk model Hermes. Hosting website, kuota internet dan listrik dikelola terpisah.

## 1 Siapkan folder dan Codex

1. Simpan ZIP handoff di folder privat, misalnya `C:\Work\handoff-career-v3`. Ekstrak di sana.
2. Pasang Git dan versi Node.js yang didukung stack yang akan dipilih Codex, melalui situs resmi. Jangan menganggap runtime internal Hermes tersedia sebagai Node untuk proyek website.
3. Buka PowerShell dan periksa:

```powershell
git --version
node --version
npm --version
```

4. Clone repository ke folder kode terpisah. Jika sudah ada checkout, buka checkout tersebut dan periksa `git status`; jangan clone di dalamnya.

```powershell
git clone https://github.com/grdviriyandraa/career-opportunity-tracker.git
Set-Location career-opportunity-tracker
git status
```

Repo masih kosong saat audit. Warning empty repository dapat terjadi dan bukan kegagalan autentikasi. Jangan mengganti branch atau menghapus file pengguna tanpa inspeksi.

5. Buka folder repository pada Codex app/IDE yang kamu gunakan, lalu sign in. Untuk CLI, ikuti tab Windows pada [panduan resmi Codex CLI](https://learn.chatgpt.com/docs/codex/cli), buka direktori repo dan jalankan `codex`. Pilih metode sign-in yang tersedia untuk akunmu. [O1]
6. Beri Codex lokasi folder handoff dan salin PROMPT_CODEX.md. Mulai WP00–WP02. Lanjutkan WP03 untuk data deadline, WP04–WP05 untuk Google dan histori, kemudian WP06–WP08 untuk integrasi agent. Keberhasilan login Codex belum membangun aplikasinya.
7. Untuk Codex yang berjalan di cloud, folder laptop tidak otomatis tersedia. Lampirkan paket jika antarmukanya mendukung; jika tidak, sediakan spesifikasi yang disanitasi melalui repo dan simpan konfigurasi pribadi di secrets environment. Jangan commit seluruh paket privat.

## 2 Instal Hermes di Windows

Jalur yang dipakai panduan ini adalah installer source native resmi agar launcher CLI dapat diperiksa. Buka PowerShell, baca halaman instalasi resmi, kemudian jalankan perintah resminya:

```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)
```

Tutup dan buka ulang PowerShell. Periksa `Get-Command hermes -All`, lalu `hermes --help`. Installer native menempatkan data default pada `%LOCALAPPDATA%\hermes`; gunakan path sebenarnya bila konfigurasi instalasi berbeda. Jalur Desktop MSIX adalah alternatif, dengan syarat Windows tersendiri; jangan memasang dua distribusi sekaligus untuk pilot. [H1, H2]

```powershell
Get-Command hermes -All
hermes --help
```

Jika launcher tidak ditemukan, periksa PATH/hasil installer. Jangan mematikan kontrol keamanan Windows untuk memaksa instalasi. Catat Windows build dan versi Hermes yang benar-benar terpasang.

## 3 Jalankan model lokal di Windows

1. Periksa Task Manager → Performance. Catat RAM terpasang dan tersedia, model GPU, dedicated GPU memory bila ada, serta ruang disk kosong. Qwen3.5 4B adalah kandidat awal dengan dukungan tools. Kelayakannya pada IdeaPad Slim 5i perlu diukur memakai konteks Hermes.
2. Pasang Ollama dari [halaman Windows resmi](https://ollama.com/download/windows). Di PowerShell, atur dua variabel berikut pada akun Windows yang menjalankan Ollama. Konfigurasi ini berlaku untuk aplikasi Ollama milik akun tersebut. Keluar dari Ollama melalui system tray lalu buka kembali agar nilainya terbaca.

```powershell
[Environment]::SetEnvironmentVariable('OLLAMA_NO_CLOUD','1','User')
[Environment]::SetEnvironmentVariable('OLLAMA_CONTEXT_LENGTH','65536','User')
```

3. Pertahankan alamat dengar pada loopback. Unduh tag lokal dan periksa server. Unduhan model awal memerlukan internet.

```powershell
ollama --version
ollama pull qwen3.5:4b
ollama list
Invoke-RestMethod 'http://127.0.0.1:11434/v1/models'
```

4. Dalam profil Hermes khusus Telegram, jalankan `hermes setup` (atau `hermes model` pada instalasi lama). Pilih **Custom Endpoint**, isi `http://127.0.0.1:11434/v1`, pilih tag lokal persis seperti keluaran Ollama, dan kosongkan API key. Jika wizard meminta nilai untuk endpoint tanpa autentikasi, gunakan placeholder lokal `no-key`. Samakan context length Hermes dengan 65536 di server. Quickstart Hermes menetapkan minimum 64K token. Catat versi dan minimum yang dipersyaratkan versi terpasang.
5. Periksa konfigurasi model utama, fallback dan model bantu termasuk kompresi. Arahkan fungsi bantu yang diperlukan ke endpoint lokal; nonaktifkan fungsi yang memerlukan model eksternal. Jangan tambahkan kredensial provider cloud ke profil ini. Jalankan `hermes chat`, tanyakan “Apa tugas business analyst?”, lalu periksa `ollama ps` ketika model masih termuat. Catat tag, context aktual, CPU/GPU, memori serta durasi respons. Hentikan pilot jika konteks minimum gagal dimuat atau terjadi kehabisan memori.
6. Sesudah adapter WP07 tersedia, minta “Apa deadline minggu ini?” dengan satu milestone sintetis. Periksa pemanggilan tool dan cocokkan jawabannya dengan website. Kirim perintah simpan satu URL sintetis, lalu verifikasi satu draft di Inbox. Matikan Ollama dan ulangi pertanyaan sesuai H19. Periksa bahwa semua rute inferensi tetap lokal serta tidak ada mutasi akibat permintaan yang gagal. Hidupkan kembali Ollama dan ulangi uji baca.

**Syarat pilot:** minimal 18 dari 20 dialog pada fixture lulus, semua uji kritis lulus, dan H19 membuktikan kegagalan tertangani tanpa inferensi cloud. Bila laptop terlalu lambat atau model gagal memanggil tool, catat hasil dan coba kandidat lokal lain yang memenuhi konteks minimum. Website dan pengujian adapter dapat dilanjutkan secara terpisah. Uji perangkat belum dijalankan.

[Sumber Hermes untuk Ollama](https://hermes-agent.nousresearch.com/docs/guides/local-ollama-setup) · [Konteks minimum Hermes](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart) · [Pengaturan lokal Ollama](https://docs.ollama.com/faq) · [Katalog Qwen3.5 4B](https://ollama.com/library/qwen3.5:4b).

## 4 Buat bot Telegram khusus

1. Buka [BotFather resmi](https://t.me/BotFather).
2. Kirim `/newbot`, pilih nama tampilan dan username yang berakhir `bot`.
3. Simpan token di tempat privat lokal. Jangan menempelkannya ke repository atau percakapan Codex.
4. Gunakan `/setjoingroups` di BotFather untuk menonaktifkan penambahan bot ke grup. Pilot hanya private chat. [T2]

Bot ini khusus Hermes. Jangan menghubungkan token yang sama ke Apps Script, webhook Next.js, bot lain atau instance Hermes kedua.

## 5 Batasi akun dan hubungkan Telegram

Cari numeric Telegram user ID akunmu; username bukan user ID. Dokumentasi Hermes menawarkan @userinfobot sebagai bantuan, tetapi itu layanan tambahan; alternatif gunakan alur identifikasi lokal yang didukung gateway. Jangan memberikan token bot ke bot pencari ID. Jalankan:

```powershell
hermes gateway setup
```

Pilih Telegram, isi bot token dan numeric allowed user ID pada wizard lokal. Periksa `TELEGRAM_ALLOWED_USERS` hanya berisi akunmu, tanpa wildcard. Jangan membuka akses grup/channel. Sebelum menerima pesan, terapkan pembatasan tool di langkah 6 pada profile yang sama, lalu kembali ke sini. Kemudian:

```powershell
hermes gateway
```

Buka private chat bot, kirim `/start` lalu pertanyaan umum. Hentikan gateway foreground dengan Ctrl+C ketika selesai. [H4]

**Bukti selesai:** akunmu mendapat respons; akun tidak diizinkan tidak memperoleh percakapan/data; tidak ada dua proses gateway. Jangan menguji penolakan memakai ID palsu hanya di prompt—gunakan transport/config test dan, bila tersedia, akun penguji terpisah.

## 6 Batasi kemampuan Hermes sebelum membaca tracker

Gunakan profile Hermes khusus proyek atau instalasi yang dikhususkan untuk pilot. Lewat `hermes tools`, periksa toolsets untuk platform Telegram. Aktifkan hanya kemampuan percakapan minimum dan MCP tracker setelah tersedia. Matikan terminal, file browsing/edit, browser, web research, cron, delegation/code execution dan koneksi Google/GitHub pada profile ini. Verifikasi daftar tool efektif, termasuk tool yang disediakan plugin. [H6]

Jangan menyalin semua tools default ke bot hanya karena bot milik pribadi. Policy `examples/HERMES_BEHAVIOR.md` menjadi arahan bahasa/perilaku dan bukan pengganti otorisasi backend. Gabungkan ke konfigurasi identity/prompt profile yang didukung versi terpasang tanpa menimpa preferensi Hermes yang sudah ada. Jika isolasi capability tidak terbukti, hentikan koneksi ke data pribadi dan selesaikan WP08 dahulu.

## 7 Minta Codex menyiapkan adapter tracker

Tahap ini membutuhkan source aplikasi, bukan hanya instalasi Hermes. Kirim prompt WP06–WP08 dari CODEX_TASK_PROMPTS.md. Codex harus menghasilkan:

- Empat agent routes sesuai kontrak, service domain bersama dan validasi scope.
- Settings > Hermes untuk membuat, melihat metadata dan mencabut credential.
- `tools/tracker-mcp` dengan build script, empat tool, ledger retry dan contoh konfigurasi Windows.
- Test server authorization, dedup, response schema, retry dan discovery.
- README dengan nama script aktual. Perintah pada langkah berikut hanya berlaku setelah script ini benar-benar dibuat.

Untuk menjalankan website, ikuti README hasil Codex: dependency install dari lockfile, environment lokal, migrations ke database uji, lalu dev server. Buat akun owner sesuai prosedur aplikasi. Verifikasi simpan satu draft langsung dari website sebelum menghubungkan bot. Jangan mengaktifkan write Calendar saat hanya menguji agent capture.

## 8 Buat credential integrasi dan build bridge

1. Login website sebagai owner. Buka Settings > Hermes, buat grant tiga scope pada kontrak, periksa expiry.
2. Simpan token sekali tampil ke file credential privat, misalnya `C:/Users/<USER>/AppData/Local/career-tracker/agent-token.txt`. Jangan isi placeholder `<USER>` secara literal.
3. Batasi akses file ke akun Windowsmu menggunakan pengaturan keamanan file. Jangan taruh file di repo atau folder berbagi.
4. Jalankan build bridge sesuai README. Target script yang diminta adalah `npm run build:mcp` pada root repo; jika belum ada, kembali ke WP07.
5. Pastikan `tools/tracker-mcp/dist/index.js` benar-benar ada. Catat path executable Node dari `Get-Command node`.

Hanya token agent yang diberikan ke bridge. Token Telegram tetap dikelola Hermes; Google credential dan database credentials tetap di backend.

## 9 Sambungkan MCP ke Hermes

Jalankan `hermes config edit` dan gabungkan bagian `mcp_servers` dari `examples/hermes.config.example.yaml`. Jangan mengganti seluruh config atau membuat duplicate YAML keys. Ubah path Node, path file bridge dan credential file sesuai laptop. Config memakai `tools.include` untuk empat nama tool dan mematikan utility resources/prompts yang tidak diperlukan. [H5, H7]

Bridge membaca `TRACKER_API_BASE_URL` dan `TRACKER_API_TOKEN_FILE` dari env konfigurasi MCP. Nama variabel ini milik adapter yang harus dibuat Codex, bukan variabel bawaan Hermes. Backend lokal memakai loopback; backend hosted memakai HTTPS. Bot tidak membutuhkan public tunnel ke laptop.

Mulai ulang gateway atau session Hermes setelah konfigurasi tersimpan. Pastikan empat tool ditemukan; periksa log hanya untuk status, tanpa menyalin credential. Bila tools kosong, periksa path, Node runtime, build output dan error stderr. Jangan menambahkan akses DB langsung sebagai jalan pintas.

## 10 Jalankan uji fungsional berurutan

Gunakan fixture sintetis di database uji, bukan lamaran nyata. Catat actual result, screenshot UI yang aman dan request ID untuk tiap uji.

| Pesan atau tindakan | Hasil yang harus terlihat |
|---|---|
| Apa itu business analyst | Jawaban umum tanpa query tracker yang tidak diperlukan |
| Tampilkan internship remote di tracker | Hasil tool, jam unknown tidak dianggap <=20 |
| Deadline minggu ini apa | Milestone Asia/Jakarta; date-only tetap tanpa jam |
| Simpan https://jobs.example.org/role?id=DEMO-101 | Draft baru atau receipt existing, link website |
| Buka Inbox website | Draft yang sama, belum reviewed/applied |
| Kirim permintaan simpan identik lagi | Tidak ada peluang kedua untuk exact identity |
| Ubah status menjadi sudah apply | Bot mengarahkan ke website; backend tidak dimutasi |
| Matikan backend, tanya status | Bot menyebut data tidak dapat diambil; tidak memakai ingatan sebagai status terkini |
| Cabut credential di website | Panggilan berikutnya gagal; website tetap dapat dipakai |
| Buat ulang credential dan reconnect | Akses pulih tanpa duplikasi draft |

Domain example.org pada fixture tidak harus menyediakan halaman nyata. Keberhasilan menyimpan draft tidak bergantung pada keberhasilan fetch halaman contoh. Pengujian lookup idempotensi setelah timeout dilakukan harness Codex, bukan dengan berulang kali menekan tombol secara acak.

## 11 Tetapkan cara penggunaan laptop

Gateway harus aktif, laptop tidak sleep dan internet tersedia untuk respons langsung. Jika backend ikut lokal, proses backend juga harus aktif. Autostart Windows dapat dipertimbangkan setelah uji manual lulus; native guide menyediakan `hermes gateway install`, tetapi gunakan satu mode proses saja. [H2]

Untuk pilot pertama, tetap gunakan foreground agar start/stop jelas. Pesan yang dikirim saat offline belum tentu diproses setelah restart. Dokumentasi Telegram menyatakan update hanya disimpan sampai 24 jam; Hermes juga memiliki kebijakan pending-update saat cold boot. Uji perilaku versi terpasang; jangan menjadikan chat offline sebagai inbox andal. [T1, H4]

Jika ingin menyimpan link ketika bot offline, gunakan website yang sudah dihosting atau catat link sementara dan kirim ulang saat aktif. Riset existing, Calendar dan backup tetap mengikuti pemilik scheduler pada kontrak. Notifikasi Telegram proaktif belum diaktifkan.

## 12 Review sebelum data nyata

Lengkapi gate G0–G4 pada lingkungan uji beserta bukti H01–H24 dan R01–R05 yang relevan. Ajukan G5 setelah uji owner. Pastikan scope tepat, rute model lokal dan H19 terverifikasi, tidak ada fitur shell/coding via Telegram, dan bot private-only terbukti. Uji setidaknya satu draft nyata yang memang ingin disimpan, cek sumber dan tanggalnya di website, lalu catat hasil pilot. Google live adalah gate tersendiri; bot yang membalas tidak membuktikan Calendar sudah tersinkron.

## Troubleshooting singkat

| Gejala | Pemeriksaan berikutnya |
|---|---|
| Hermes tidak ditemukan | Terminal baru, PATH, Get-Command hermes -All |
| Chat umum gagal | Proses Ollama, tag, ketersediaan RAM serta konteks efektif; selesaikan sebelum MCP |
| Bot diam | Gateway aktif, numeric allowlist, token valid, satu receiver |
| Tool tidak muncul | Build bridge, executable path, YAML, daftar tool efektif |
| 401 | Expiry/revoke/token file; buat ulang grant via website |
| 403 | Scope/owner; jangan memperluas akses melebihi baseline |
| Connection refused | Dev server belum hidup atau base URL/port salah |
| Draft tersimpan tetapi bot timeout | Replay intent lama dan cek receipt; jangan buat manual duplikat |
| Jam/tanggal membingungkan | Zona Asia/Jakarta, date-only, source_checked_at |

Panduan pemulihan lebih lengkap: OPERATIONS_RUNBOOK.md. Tidak ada secret, bot atau koneksi baru yang dibuat oleh dokumen ini.


## Pemeriksaan riwayat setelah koneksi berhasil

1. Minta Codex memuat fixture research_history.synthetic.json di database uji dan menjalankan R01–R04. Buka Inbox, pilih run kedua dan cocokkan 20 total, delapan pemeriksaan sumber, empat peluang baru dan nol confirmed.
2. Pada Telegram, tanyakan status salah satu posisi uji. Cocokkan tahap pribadi dan waktu periksa sumber dengan detail website. Tanyakan juga total historis per run. Jika tool tidak menyediakan agregat, Hermes harus menunjukkan tempat memeriksanya di Inbox.
3. Pastikan percakapan tersebut tidak membuat draft, mengubah tahap, menerbitkan event, atau menjalankan pencarian baru. Simpan bukti R05 tanpa token atau data pribadi. Pemilik menjalankan uji live sesudah model berjalan lokal dan H19 lulus.
