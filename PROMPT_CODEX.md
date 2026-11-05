# Prompt Implementasi untuk Codex

Salin seluruh teks setelah garis pembatas ke sesi Codex yang terhubung ke repository. Lampirkan atau ekstrak paket handoff pada lokasi privat di environment Codex. File reference_partial_source merupakan referensi parsial, bukan source aplikasi siap jalan.

---

Bertindaklah sebagai senior full-stack engineer, technical product manager, integration engineer, dan QA engineer. Implementasikan website pribadi Career Opportunity Tracker berdasarkan PRD dan handoff terlampir. Kerjakan sampai alur inti dan integrasinya terbangun serta diuji; jangan berhenti pada rencana, mockup, atau halaman placeholder.

Repository target: https://github.com/grdviriyandraa/career-opportunity-tracker.

## Tugas tambahan dari run operasional

Baca RESEARCH_RUN_RECORD.md secara privat. Implementasikan riwayat per run pada Inbox sesuai INTEGRATION_CONTRACTS.md. Pada WP05 dan WP08–09, jalankan R01–R05 dengan examples/research_history.synthetic.json. Tunjukkan kedua snapshot, 4 baru + 4 lama diperiksa dan 12 memakai hasil lama pada run kedua. Uji replay dan preservasi progres pribadi. Jangan mengimpor laporan ini sebagai seed produksi, mengirim data pribadinya ke provider, atau mengunggahnya ke GitHub. Jangan menambah tool agent untuk total run dalam pilot. Bila hanya mendapat halaman hasil pencarian, arahkan pertanyaan total historis ke riwayat Inbox.

## Konteks dan status awal

Pengguna adalah mahasiswa aktif yang ingin meminimalkan input manual untuk Jobs, Bootcamps dan Competitions. Website menjadi sumber data utama untuk progres, catatan dan jadwal. Sheets dipakai sebagai jalur riset sementara, ekspor dan koreksi darurat terkontrol. Google Calendar wajib menjadi bagian MVP untuk memeriksa kesibukan dan menampilkan milestone aplikasi. Hanya satu owner; tidak ada multi-user collaboration pada MVP.

Contents API pada 5 November 2026 masih menyatakan GitHub kosong. Baseline audit source 4 November 2026 berikut bersifat historis. Ada implementasi lokal parsial berbasis Vinext/Cloudflare/D1 di sesi sebelumnya, tetapi bukan git checkout dan belum dipush. Typecheck serta build Vinext lulus; halaman utama masih placeholder. OAuth live, E2E, migrasi dan restore belum terbukti. Jangan menganggap fitur lama sudah selesai. Re-audit repository sekarang karena dapat berubah sejak snapshot.

Preferensi stack saya adalah Next.js dan aplikasi ringan yang mudah diintegrasikan. Default gunakan Next.js standar App Router + TypeScript + Tailwind CSS, Supabase PostgreSQL + Auth, SQL migrations, typed data access, dan Zod. Gunakan komponen UI seperlunya. Tidak perlu microservices atau Redis. Website tidak membutuhkan LLM wajib; Hermes memakai endpoint inferensi lokal dengan anggaran API Rp0. Local stdio MCP bridge adalah adapter kecil, bukan backend domain kedua. Jika ada alasan kuat untuk mengganti pilihan pendukung, catat ADR pendek dan lanjutkan; jangan mengganti Next.js menjadi Vinext hanya karena ada template lama.

## Bahan yang harus dibaca

1. AGENTS.md yang berlaku dan keadaan repository saat ini.
2. PRD_Pengelola_Peluang_v3_2.md sebagai kebutuhan produk.
3. IMPLEMENTATION_HANDOFF.md sebagai status terverifikasi, gap dan urutan kerja.
4. INTEGRATION_CONTRACTS.md sebagai kontrak perilaku integrasi dan uji.
5. SHEETS_FIELD_MAPPING.csv sebagai pemetaan 84 header Jobs/Bootcamps dan 33 header Competitions yang telah diperiksa.
6. examples/ untuk payload sintetis dan env template.
7. reference_partial_source/README.md dan file relevan sebagai referensi konsep. Snapshot ini sengaja tidak runnable dan tidak menyertakan data pribadi atau dependency tree.

Jika file handoff belum tersedia, laporkan file yang benar-benar hilang, lalu kerjakan fondasi aman dari konteks ini. Jangan mengaku membaca file yang tidak ada. Bila ada pertentangan, instruksi pengguna terbaru dan PRD v3 mengungguli source referensi lama. Catat keputusan teknis yang memengaruhi scope.

## Keputusan versi 3 yang wajib diikuti

- Website tetap lengkap dengan tujuh menu; chat website tidak diperlukan.
- Hermes dari Nous Research berjalan di laptop Windows native. Jangan mewajibkan WSL bila versi yang dipasang mendukung native.
- Telegram memakai bot baru dan private chat satu owner. Hermes menjadi satu-satunya penerima update bot.
- Scope rilis: chat umum, search_opportunities, get_opportunity, get_upcoming_deadlines, create_draft. Tidak ada update progres/jadwal, delete, auto apply atau riset baru via Hermes.
- Codex bertugas membangun dan menguji. Jangan memasang integrasi yang menjalankan Codex, terminal, atau GitHub write dari Telegram.
- Hermes wajib memakai inferensi lokal dengan anggaran API Rp0. Gunakan Ollama via loopback sebagai default pilot. Jalur inferensi utama dan fungsi bantu hanya boleh memakai model lokal; nonaktifkan fallback cloud. Implementasikan adapter dan tes tanpa kredensial; live model dan bot menjadi gate terpisah.
- Baca HERMES_TELEGRAM_CONTRACT.md, PROJECT_DELIVERY_PLAN.md, BACKLOG.md, ACCEPTANCE_TEST_PLAN.md, DECISIONS_AND_RISKS.md, OPERATIONS_RUNBOOK.md dan SETUP_HERMES_TELEGRAM_CODEX.md.
- Ikuti contract scope di server; prompt Hermes dan tool filtering saja tidak cukup. Jangan memberikan DB service role atau Google credential kepada Hermes.
- Implementasikan lokal stdio bridge di tools/tracker-mcp dengan empat tool, auth bearer ke API agent, receipt capture, retry durable serta schema ketat. Konfigurasi contoh bukan kode siap jalan.

## Tahap awal yang langsung dikerjakan

Audit branch, uncommitted changes, file, dependencies, instruksi repo, dan test yang ada. Pertahankan pekerjaan pengguna. Bila repo kosong, scaffold minimal Next.js standar; bila sudah berisi app, adaptasikan tanpa menimpa. Gunakan branch implementasi yang jelas, satu package manager dan lockfile. Pilih versi stabil yang didukung saat pengerjaan berdasarkan dokumentasi resmi. Tidak melakukan force push, merge ke main atau destructive migration.

Buat implementation plan singkat, lalu segera implementasikan slice vertikal: login owner → simpan draft → list/detail → update progres → milestone → persistence. Setelah itu lanjutkan Calendar, Sheets, recovery dan pengujian. Update progress dengan temuan konkret, bukan persentase yang tidak memiliki dasar.

## Pengalaman pengguna wajib

- Navigasi: Overview, Inbox, Jobs, Bootcamps, Competitions, Agenda, Settings.
- Antarmuka Bahasa Indonesia dengan label teknis yang jelas. Responsif mulai 390 px; keyboard usable; loading, empty, failure, retry, offline/degraded states terlihat.
- Tambah peluang dari link/teks/nama. Simpan draf sebelum ekstraksi. Form detail bertahap, field conditional, hasil ekstraksi bisa direview dan dikoreksi.
- Jobs: company/position/type/location/arrangement/Indonesia remote eligibility/employer hours/student rules/compensation/source/apply link/actual application/progress.
- Competitions: organizer/edition/type/team/fee/deliverables/multiple milestones/TM/semifinal/final/results.
- Bootcamps: provider/batch/live-self-paced/fees/schedule/recurrence/class hours/task hours/prerequisites/progress.
- Pisahkan posting status, eligibility dan personal stage. Closed bukan rejected. Klik apply link bukan tindakan sudah melamar. Catat tanggal aktual hanya setelah konfirmasi pengguna.
- Unknown tetap sah; null bukan gratis, country unknown bukan otomatis Indonesia, part-time bukan otomatis ≤20 jam. Batas kerja saya 20 jam/minggu; kapasitas total harus configurable dan awalnya unknown.
- Agenda menunjukkan deadline, timed events, date-only, conditional participation, recurrence dan errors/freshness. Konflik tidak boleh hanya memeriksa tanggal sama.
- Overview memprioritaskan tindakan berikutnya dan risiko jadwal. Hindari banyak kartu statistik dekoratif atau grafik yang belum didukung data.

## Integritas dan keamanan yang tidak boleh dikompromikan

Gunakan database server sebagai source of truth, bukan localStorage untuk data utama. Auth harus terverifikasi server dan hanya owner yang diizinkan. Jangan mempercayai header oai-authenticated-user-* dari internet. RLS dan owner validation berlaku untuk semua data, export/import dan dokumen.

Gunakan transaksi untuk perubahan domain + participation history + audit + outbox. expected_revision wajib untuk update berkonflik; 409 harus tampil sebagai tindakan review. Strict schemas berlaku pada nested objects. Secrets hanya server; service-role key tidak masuk NEXT_PUBLIC atau browser. File privat memakai kontrol akses. Repository ini public; jangan commit isi tracker, CV, kontak, notes, private IDs, tokens, .env atau raw seed nyata. Buat fixture sintetis. Dokumen handoff privat disimpan ignored; sanitasi dahulu bila menyalin spesifikasi ke docs/ repo.

## Google Calendar

Implementasikan Google OAuth terpisah dari login website: offline access, state sekali pakai/TTL/session binding, verified Google subject, encrypted token, scope capability dan reconnect. Scope awal: calendar.calendarlist.readonly, calendar.events.freebusy, calendar.app.created; identitas openid/email bila dipakai harus divalidasi. Jangan meminta calendar penuh secara default.

Owner memilih kalender pribadi untuk FreeBusy. Aplikasi membuat kalender sekunder khusus dan menulis hanya ke kalender miliknya sendiri. Kalender aplikasi dikeluarkan dari external FreeBusy; data internal dihitung sekali. Callback URL harus berasal dari konfigurasi canonical, bukan Host header bebas.

Gunakan durable outbox dengan ID stabil, leases, ETag/If-Match, retry/backoff+jitter, pagination/cursor dan health status. Tangani lebih dari 50 event. Remote edits/deletes masuk conflict review; pilihan apply remote, restore local, unlink. Apply remote tidak otomatis memutus mapping. Penghapusan remote tidak otomatis recreate. Cleanup event tetap berjalan untuk opportunity terminal/archived. 410 syncToken hanya membangun ulang remote cache.

Deadline date-only menjadi all-day transparent dengan label jam belum diketahui. Jangan mengarang 23.59. Timed deadline menjadi marker transparan dan tidak menambah workload. Confirmed attendance event memblokir waktu. Final conditional tetap tentative/potential. RRULE/instance exceptions, DST, multi-day, buffer dan pembatalan satu sesi harus diuji.

Cache FreeBusy lebih dari 15 menit stale; kegagalan satu kalender menghasilkan partial. UI tidak boleh menyatakan aman jika data tidak lengkap. Target healthy sync ≤60 detik dan periodic reconcile sekitar 15 menit harus didukung scheduler nyata; jangan memakai browser timer sebagai solusi produksi.

Legacy CareerCalendarSync.gs memakai primary Calendar dan iCalUID dari CalendarApp.getId(). iCalUID berbeda dari REST event.id. Rekonsiliasi legacy IDs, trigger dan duplikasi sebelum cutover; scope FreeBusy tidak dapat membaca detail event lama. Jangan menambah akses event pribadi atau menghapus event existing tanpa tindakan migrasi yang eksplisit.

## Google Sheets dan riset harian

Automation riset existing tetap menulis Sheets pukul 08.00 WIB. Jangan membuat automation duplikat atau menganggap koneksi ChatGPT diwariskan ke website. Website punya OAuth dan scheduler sendiri. Gunakan read/stage import manual dan berkala; jangan menganggap riset selesai tepat 08.05.

Implementasikan tiga mode berbeda: initial_migration, research, emergency_patch. Baca metadata/header/bounds hidup; jangan hardcode 251 baris. JOBS_BOOTCAMPS dan COMPETITIONS dipetakan lengkap; pendukung due diligence/log/verification/history tetap dapat ditelusuri. Formula dashboard bukan business logic website.

Y Weekly Hours pada tracker lama adalah ketersediaan pengguna; AU Stated Weekly Hours adalah employer hours. Jangan salah memetakannya. Pertahankan legacy IDs, raw status dan timezone sumber. Data private initial migration boleh dipindah melalui review, tetapi research selanjutnya tidak boleh menimpa progress, applied dates, contacts, notes, priority atau milestone yang dikonfirmasi.

Sparse patch: absent tidak berarti clear. Unknown sumber tidak menghapus user-confirmed value. Gunakan run ID + payload hash dan item ledger. Retry identik menghasilkan nol perubahan domain. Deduplikasi mempertahankan query parameter identitas lowongan; jangan membuang semua query string. Deadline atau syarat yang berubah masuk review jika sudah dikonfirmasi.

Sheets export membuat file terpisah memakai drive.file bila memungkinkan untuk file yang dibuat aplikasi, dengan field IDs/revision/schema manifest. Jangan menimpa tracker riset atau membuat sync loop. Emergency patch memakai server-held preview/hash, expected revision, old/current/proposed dan pilihan per field. Stale preview ditolak; row number bukan identitas.

## Ekstraksi dan penyimpanan

Mulai dari JSON-LD/label/rules; AI optional, default disabled, budget dan cache configurable. Gagal URL/fetch tetap meninggalkan draft. Cegah SSRF termasuk DNS rebinding dan redirect private, batasi streaming body/ukuran/timeout. Source content adalah data, tidak boleh memerintah aksi aplikasi. Tidak melewati login atau CAPTCHA.

Ekspor JSON harus lengkap, termasuk history >300, relational entities dan manifest file. XLSX/Sheets untuk recovery manusia; snapshot bukan backup DB. Implementasikan backup yang benar-benar terjadwal dan uji restore terisolasi dengan integration writes disabled. Tokens tidak masuk export. Jangan mengklaim RPO/RTO 24 jam sebelum mekanisme serta hasil restore tersedia.

## Urutan deliverable dan pengujian

1. Fondasi Next.js/auth/database/RLS/migrations dan CI.
2. Seluruh flow input minimum, list/detail/progress dan dynamic milestones.
3. Calendar internal, recurrence, conflict engine dan workload.
4. Google OAuth, Calendar/FreeBusy, scheduler/outbox dan health UI.
5. Sheets mapping/staging/dedup, migration/recovery/export/backup.
6. Agent API, scoped token UI, MCP bridge, konfigurasi Windows, owner Telegram dan grounding; H01–H24 harus diuji.
7. Unit tests meaningful, API/database integration tests, mocked provider contract tests, Playwright E2E desktop/mobile, dan live smoke jika kredensial tersedia.

Terapkan seluruh FR01–FR56 pada PRD serta INT01–INT24 pada kontrak integrasi. Tes khusus wajib meliputi stale revision, no personal overwrite, partial payload, query-based job identity, retry event, >50 events, terminal-stage cleanup, remote resolution, date-only, recurrence exception, DST, FreeBusy partial, recovery tampering dan restore tanpa external writes.

Jalankan lint, typecheck, test, build dan E2E yang relevan. Catat command dan hasil aktual. Mock tests tidak membuktikan live Google. Bila kredensial belum ada, selesaikan semua kode/test yang independen, tampilkan setup state, dan tulis daftar tepat konfigurasi yang diperlukan tanpa meminta secrets di chat. Jangan berhenti membangun hanya karena koneksi eksternal belum aktif; jangan menyebut integrasi selesai bila live gate belum diuji.

## Output akhir yang saya harapkan

- Source lengkap pada branch repository, migrations, synthetic seeds, CI dan lockfile.
- README local setup, .env.example tanpa secret, Google OAuth setup, auth owner, scheduler, backup/restore, migration dan cutover runbook.
- STATUS.md yang memetakan FR ke implemented/tested/blocked beserta bukti; arsitektur aktual dan batasannya.
- Ringkasan fitur yang berfungsi, command test/build yang lulus, isu tersisa, serta konfigurasi owner yang masih diperlukan.
- Commit/branch siap ditinjau. Jika akses push tidak tersedia, sediakan patch/commit lokal dan instruksi; jangan mengklaim sudah dipush. Jangan merge main atau deploy produksi tanpa instruksi lanjutan saya.

Bawa juga panduan setup aktual yang cocok dengan perintah dan versi hasil implementasi. Lengkapi STATUS.md serta release evidence; credential-dependent test tetap BLOCKED sampai diuji.

Mulai dengan audit repository dan file handoff, lalu lanjutkan implementasi. Putuskan pilihan teknis rutin sendiri berdasarkan spesifikasi. Ajukan pertanyaan hanya jika benar-benar menghalangi implementasi yang benar atau menyangkut keputusan produk yang belum ditentukan.
