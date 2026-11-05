# Kontrak Integrasi dan Desain Teknis

Versi 3.2 | 5 November 2026 | Companion PRD Pengelola Peluang.

Dokumen ini adalah desain target, bukan pernyataan bahwa integrasi sudah berfungsi. Istilah MUST berarti kriteria penerimaan. Contoh payload memakai data sintetis. Nama endpoint adalah kontrak usulan; implementasi boleh menyesuaikan nama selama perilaku, kontrol, dan pengujiannya sama.

## 1 Arsitektur target

Gunakan Next.js standar dengan App Router dan TypeScript. Server Components untuk pembacaan awal; Client Components hanya untuk interaksi. Supabase PostgreSQL menjadi pilihan awal database dan Supabase Auth untuk sesi aplikasi pribadi. Supabase Storage privat hanya diperlukan bila unggahan diaktifkan. Gunakan SQL migrations, typed database client, dan Zod untuk boundary validation. Tidak perlu Express, Nest, microservices, Redis, atau LLM wajib untuk MVP ini.

Keputusan Supabase adalah rekomendasi implementasi yang dapat diganti dengan PostgreSQL setara melalui ADR singkat. Preferensi pengguna yang eksplisit adalah Next.js dan aplikasi ringan. Pilih rilis stabil yang masih didukung saat implementasi, pin versi dan lockfile, lalu verifikasi dokumentasi resmi. Jangan menyalin version pin Vinext starter sebagai dasar Next.js produksi.

| Sistem | Data yang dimiliki | Hubungan |
|---|---|---|
| Next.js dan PostgreSQL | Peluang, progres, tindakan, milestone, keputusan pengguna, audit | Sumber data utama setelah cutover |
| Google Calendar pribadi | Interval sibuk dari kalender yang dipilih | Read-only FreeBusy; tidak mengimpor judul/detail pribadi |
| Calendar khusus aplikasi | Proyeksi milestone yang disetujui | Write melalui outbox; perubahan remote masuk review |
| Sheets riset yang sudah ada | Temuan publik dan jejak riset | Dibaca ke staging/Inbox; tidak menjadi master progres |
| Sheets ekspor terpisah | Snapshot data pilihan pengguna | Keluaran; tidak dibaca lagi sebagai feed riset |
| Automation ChatGPT | Menemukan/verifikasi peluang dan memperbarui Sheets | Sistem terpisah; bukan scheduler website dan bukan API yang otomatis dapat dipanggil website |
| Hermes lokal | Percakapan dan pemanggilan tool terbatas | Baca tracker dan capture draft melalui agent API; bukan master data |
| Telegram | Pesan owner ke Hermes | Satu gateway, private chat, laptop harus aktif |
| Codex | Pembangunan dan pengujian kode | Tidak dipanggil Hermes saat runtime |
| GitHub | Source, migrations, synthetic fixtures, CI, dokumentasi teknis | Tidak menyimpan data akun atau tracker pribadi |

Simpan mutation bisnis, audit, dan outbox di satu transaksi database. Worker memproses outbox dengan lease, attempt count dan next_attempt_at. Gangguan Google tidak membatalkan transaksi data lokal. Kehilangan proses setelah commit tetap meninggalkan job yang bisa dilanjutkan.

## 2 Auth aplikasi dan batas owner

Default desain: Supabase Auth dengan magic link atau OTP email untuk satu email owner yang dikonfigurasi server. Matikan public signup dan provision akun owner secara eksplisit. Setelah autentikasi, server memeriksa immutable auth user ID yang diizinkan; email hanya digunakan pada bootstrap yang tervalidasi. Jangan memakai claim email dari body request.

Seluruh route handler, Server Action, download file, export, import, dan query privat harus memverifikasi sesi. Redirect UI saja tidak cukup. Mutasi berbasis cookie memerlukan proteksi CSRF/origin; machine endpoint cron memakai kredensial terpisah dan tidak menerima request browser biasa. Rate-limit auth, capture, import dan integrasi sesuai beban personal.

Semua tabel milik pengguna memiliki owner_id. Aktifkan RLS untuk tabel yang terekspos; SELECT/INSERT/UPDATE/DELETE dibatasi auth.uid() = owner_id dengan WITH CHECK yang sesuai. Selain RLS, owner tunggal harus diperiksa di server. Database function yang SECURITY DEFINER memerlukan search_path tetap, validasi pemanggil dan grant sempit. Integrasi dan token disimpan di schema/tabel yang tidak dapat dibaca client.

Service-role key hanya digunakan pada worker atau operasi server yang memerlukannya; bukan jalur CRUD client default. Uji anon, sesi user lain, ID lintas owner, forged owner_id, spoofed oai-* header dan tautan file. Preview tanpa konfigurasi tidak boleh berpura-pura menyimpan data. Demo opsional harus diberi label, memakai fixture sintetis, dan terpisah dari produksi.

## 3 Model penyimpanan minimum

| Tabel atau kelompok | Field inti dan constraint |
|---|---|
| profiles | owner_id unique, display_name, timezone, max_work_hours=20, total_capacity nullable, buffers, onboarding flags |
| organizations | id UUID, owner_id, name, canonical_domain nullable, credibility, evidence refs |
| opportunities | id UUID, owner_id, category, title nullable untuk draft, organization_id, personal_stage, posting_status, eligibility, priority, quality_status, archived_at, revision integer, created_at, updated_at |
| external_identities | owner_id, source_system, external_id, opportunity_id; unique(owner_id, source_system, external_id) |
| job_details | opportunity_id unique, role family, employment, arrangement, locations, remote eligibility, employer_hours min/max, duration, student rules, compensation status/range/currency/unit |
| competition_details | opportunity_id unique, edition, discipline/type, participation, team data, fee status/amount/unit, deliverables, benefits |
| bootcamp_details | opportunity_id unique, batch, format, prerequisites, start/end, weekly class/task hours, fee, graduation criteria |
| sources dan field_evidence | URL/text hash, raw value, field path, normalized value, fetched_at, source_claimed_at, confidence, review status, user_locked |
| milestones | id UUID, opportunity_id, type, title, temporal_precision, local_start_date/local_end_date, start_at/end_at nullable, timezone, certainty, attendance, lifecycle, location, publish_policy, revision |
| recurrence dan exceptions | series_id, RRULE, original local occurrence key, cancelled/moved override; unique(series_id, original_occurrence_key) |
| actions dan participation_events | jenis, tanggal aktual, milestone/opportunity relation, completion/undo relation; jangan menyimpulkan tindakan dari klik link |
| contacts dan documents | owner, relation, private object key atau external URL, version, MIME/size/checksum; tidak embedded dalam Calendar |
| calendar_connections | owner, Google subject, encrypted tokens, scopes, expiry, status, encryption key version |
| calendar_links | milestone/occurrence, app_calendar_id, event_id, iCalUID optional, etag, baseline payload/hash, synced local revision, status; unique connection/calendar/event dan milestone occurrence mapping |
| calendar_busy_cache | connection, selected calendar, exact coverage window, fetched_at, intervals, per-calendar errors |
| import_runs dan import_items | source_system, run_id, payload_hash, status/counts, item_key/hash, source_version, validation issues; unique owner/source/run dan item identity |
| change_proposals | field diffs, current revision, source evidence, user decision; public changes tidak langsung menjadi personal changes |
| recovery_previews | preview_id, owner, immutable parsed payload/hash, base revisions, allowed field choices, expiry, applied_at |
| outbox dan job_runs | idempotency key, entity/revision, action, status, lease, cursor, attempts, next_attempt_at, last_error; unique idempotency key |
| change_history | immutable actor/source, entity, before/after atau patch, related run, timestamp; semua baris dapat diekspor |
| export_snapshots | id, schema_version, counts, checksums, created_at, file inventory, destination, completion status |

Gunakan numeric/decimal untuk uang, bukan floating point. Null bukan nol. String kosong dinormalisasi hanya sesuai schema field. UUID internal berbeda dari legacy JOB-0001. Foreign key dan transaksi menjaga relasi. JSONB boleh untuk raw source, evidence, atau metadata fleksibel, bukan pengganti seluruh hubungan inti. Hindari hard delete untuk riwayat partisipasi dan audit.

Date-only disimpan sebagai DATE/local date, tidak dikonversi diam-diam ke UTC midnight. Acara berjam pasti menyimpan instant UTC, IANA timezone asal, dan local wall time bila dibutuhkan untuk recurrence. Tanggal yang ambigu seperti 03/04/2026 wajib memakai locale dan tipe cell sumber; jika tidak cukup bukti, masuk review. Australia membutuhkan pengujian daylight saving; jangan hardcode offset +07 untuk semua kegiatan.

## 4 API dan transaksi

| Endpoint usulan | Perilaku utama |
|---|---|
| POST /api/opportunities/drafts | Menerima category + salah satu URL/text/title; menyimpan draft sebelum ekstraksi; mengembalikan id/revision |
| GET /api/opportunities | Pagination, search dan filter terindeks; owner server-side |
| PATCH /api/opportunities/:id | Sparse allowed fields + expected_revision; 409 bila stale; transaksi bersama audit |
| POST /api/opportunities/:id/actions | Mark applied/registered/submitted/undo dengan actual date dan idempotency key |
| POST /api/opportunities/:id/milestones | Validasi temporal; save + outbox pada transaksi; konflik ditampilkan tetapi user dapat melanjutkan |
| POST /api/extractions | draft_id, source_ref, extraction_version; hasil proposal field, tidak overwrite confirmed data |
| POST /api/integrations/google/connect | Capability calendar atau sheets_read atau sheets_export; menghasilkan authorization URL |
| GET /api/integrations/google/callback | Validasi state/session/account, exchange code, simpan grant terenkripsi, redirect allowlisted |
| POST /api/calendar/check | Coverage range dan selected IDs tervalidasi; hasil lengkap/parsial/stale dan warnings |
| POST /api/calendar/sync | Enqueue delta; mengembalikan queued count, bukan langsung mengklaim synced |
| POST /api/calendar/conflicts/:id/resolve | apply_remote / restore_local / unlink dengan expected revisions |
| POST /api/imports/preview | mode initial_migration / research / emergency_patch, server-held preview, counts dan diff |
| POST /api/imports/:preview_id/apply | Pilihan record/field, expected revisions, preview hash; tidak menerima payload baru pengganti |
| POST /api/exports | Membuat snapshot konsisten JSON/XLSX/Sheets; credentials dan cache busy privat dikecualikan |
| POST /api/internal/jobs/run | Protected machine endpoint; claim lease, bounded work, retry/cursor; bukan public unauthenticated cron |

Response kesalahan menggunakan code, message yang aman, retryable, dan correlation_id. Gunakan 400 invalid input, 401 sesi/koneksi tidak sah dengan domain error terpisah, 403 owner/scope, 409 revision atau integration conflict, 413 payload besar, 429 rate limit, 503 dependency unavailable. Jangan mengeluarkan token, raw Authorization header, atau provider response sensitif di log.

## 5 Google OAuth dan setup

Autentikasi website tidak sama dengan persetujuan mengakses Google Calendar/Sheets. Google grant dikaitkan ke owner aplikasi dan identitas akun Google yang terverifikasi. Minta openid/email bila diperlukan untuk mengikat Google subject; validasi issuer, audience, expiry dan nonce ketika memakai ID token. Reconnect akun berbeda harus menjadi pergantian koneksi yang eksplisit, bukan menggabungkan token lama dengan scope baru.

| Capability | Scope yang direncanakan | Batas akses aplikasi |
|---|---|---|
| Pilih kalender | calendar.calendarlist.readonly | Hanya daftar kalender dan metadata pemilihan |
| Baca kesibukan | calendar.events.freebusy | Interval busy kalender terpilih; jangan mengambil event detail kalender pribadi |
| Kelola kalender aplikasi | calendar.app.created | Kalender sekunder yang dibuat aplikasi; ID tidak boleh ditentukan bebas oleh client |
| Baca tracker existing | spreadsheets.readonly | Backend allowlist satu spreadsheet riset yang dipilih |
| Buat ekspor Sheets | drive.file untuk file yang dibuat aplikasi | Native export pada spreadsheet baru milik aplikasi, bukan menulis tracker riset |

Scope pada tabel diberi prefix https://www.googleapis.com/auth/ kecuali openid dan email. Untuk tracker existing, drive.file dengan Google Picker bisa menjadi alternatif yang lebih sempit bila benar-benar diimplementasikan. spreadsheets.readonly tidak membatasi OAuth ke satu file; allowlist aplikasi adalah lapisan tambahan, bukan klaim batas provider. Sheets API scope tidak dapat dibatasi per tab. Export drive.file harus diuji pada operasi create/write file yang dibuat aplikasi; jangan diam-diam memperluas ke spreadsheets atau drive penuh [S1, S6].

Google Cloud setup: project, Calendar API dan Sheets API; Drive API bila diperlukan untuk file export/Picker; consent screen, support email, audience/testing user sesuai akun; OAuth Web Application; exact redirect URI development dan production. Callback usulan /api/integrations/google/callback. Origin diambil dari APP_URL yang tervalidasi, bukan Host header bebas. Domain, client ID, client secret dan akun owner belum disediakan oleh audit ini.

Authorization memakai offline access, state random sekali pakai dengan TTL, session binding, validasi callback dan redirect allowlist. Gunakan PKCE jika didukung SDK/alur terpilih dan dokumentasikan konfigurasi. Scope ditambahkan secara incremental saat fitur dipilih. Callback denial tidak menghapus koneksi sehat lama. Jika refresh token baru tidak dikirim, pertahankan token lama hanya untuk Google subject yang sama. Refresh token dan access token dienkripsi di server menggunakan authenticated encryption, key version dan secret terpisah dari database; IV unik per encryption. Refresh concurrent memakai lock. invalid_grant memicu needs_reconnect; jangan loop retry tanpa akhir [S2].

Status capability: not_configured, disconnected, connecting, connected, insufficient_scope, needs_reconnect, error. Calendar dan Sheets memiliki capability health terpisah walau grant memakai akun sama. Cabut koneksi menghentikan job, menghapus token lokal, dan menawarkan revoke provider sesuai tindakan disconnect; data peluang tetap ada. Logout aplikasi tidak otomatis menghapus Google grant.

Mode OAuth External Testing dapat menyebabkan refresh token berumur pendek dalam kondisi yang didokumentasikan Google; periksa publishing status, kebijakan user testing, dan syarat verifikasi sebelum menyatakan background sync siap stabil. Jangan menjanjikan koneksi personal bebas reconnect selamanya [S10].

## 6 Calendar mapping dan sinkronisasi

### Representasi waktu

| Jenis milestone | Representasi Calendar | Aturan konflik/reminder |
|---|---|---|
| Deadline berjam pasti | Timed event transparan dengan durasi tampilan 1 menit | Deadline domain tetap satu instant; tidak dihitung sebagai komitmen satu menit; reminder 1 jam hanya bila waktu diketahui |
| Deadline tanggal saja | All-day transparan; label Jam belum diumumkan | Tidak diasumsikan 23.59; reminder tanggal mengikuti pilihan lokal, bukan klaim jam resmi |
| Acara pasti dan ikut terkonfirmasi | Timed event opaque | Interval memblokir jadwal; reminder sesuai preferensi |
| Final tanggal saja atau bersyarat | All-day/timed transparan, tentative jika diizinkan publikasi | Potensi bentrok; tidak menjanjikan jadwal bebas |
| Recurring live class | Series dengan RRULE dan exception, atau instance materialized dengan ID stabil | Pilih satu strategi, tulis ADR, dan jangan membuat series serta salinan instance sekaligus |
| Cancelled/withdrawn/ineligible next stage | Cancel/unpublish event masa depan milik aplikasi sesuai review dan kebijakan | Cleanup tetap dijalankan walau opportunity sudah terminal/archived |

Google all-day end.date bersifat exclusive; local last date inclusive harus dikonversi plus satu hari. Status tentative dan transparency adalah dimensi berbeda. Deskripsi hanya judul peluang dan tautan internal yang aman; tidak memuat kontak HR, notes, CV atau nilai privat. Tidak ada attendees, invitations atau email sendUpdates dari MVP. Reminder default H-7/H-3/H-1 dan 1 jam untuk timed event, dapat diubah; batas provider diuji [S3].

### Outbox dan idempotensi

1. Save milestone mengubah revision dan memasukkan job calendar_upsert/cancel dengan key connection + milestone/occurrence + target revision + operation dalam transaksi.
2. Worker memverifikasi owner, capability, app calendar provenance dan publication policy. Claim job memakai lease. Baca revision terbaru agar job lama tidak menimpa perubahan baru.
3. Generate event ID stabil dan sesuai karakter provider, misalnya hex hash namespace owner/connection/milestone/occurrence dengan prefix valid. Simpan mapping sebelum retry berulang. Jangan generate ID baru setiap attempt.
4. Gunakan ETag/If-Match saat memperbarui. Perbedaan remote terhadap baseline menghasilkan conflict. 412 tidak diperlakukan sebagai sukses atau diatasi dengan overwrite tanpa review.
5. Jika insert timeout, cek ID tetap; bila provider 409, ambil event dan pastikan marker kepemilikan cocok sebelum mengadopsi. Jangan menganggap setiap event dengan ID sama milik aplikasi.
6. Simpan remote etag, hash canonical payload dan synced local revision setelah berhasil. Jika request berhasil tetapi penyimpanan mapping gagal, retry dapat menemukan event yang sama.
7. Bounded batch memakai cursor/claim berikutnya; lebih dari 50 event tetap diproses. Dead-letter/retry action terlihat setelah batas attempt. Retry memakai backoff+jitter dan Retry-After bila ada.

Reconcile kalender khusus aplikasi dapat memakai initial full list lalu incremental sync. Tangani pagination sampai halaman terakhir sebelum menyimpan nextSyncToken. Jangan mengirim kombinasi filter yang tidak sah bersama syncToken. Respons 410 memicu rebuild cache remote khusus calendar itu; tidak menghapus domain database atau tombstone lokal. Remote deletion adalah proposal, tidak otomatis dibuat kembali [S4].

### Resolusi konflik

- Apply remote: validasi temporal dan marker kepemilikan, perbarui milestone dengan expected revision, simpan audit dan baseline ETag, pertahankan mapping; periksa bentrok lagi.
- Restore local: tampilkan diff yang akan ditimpa, gunakan ETag terbaru dan tindakan pengguna, lalu enqueue overwrite yang terkontrol.
- Unlink: hentikan sync dan simpan histori keputusan; nasib remote event dijelaskan. Jangan menghapus remote secara implisit.
- Deleted remote: pilihan cancel local, recreate secara eksplisit, atau unlink. Simpan tombstone agar retry tidak menghidupkan kembali event tanpa keputusan.

Job harus memproses semua mapping aktif termasuk peluang yang diarsip atau gagal lolos. Mengubah peluang menjadi Tidak lolos mengubah hanya tahap masa depan yang bersyarat; histori yang sudah terjadi tetap utuh. Kalender khusus dihapus pengguna menghasilkan needs_setup/review; tidak otomatis membuat banyak kalender baru.

## 7 FreeBusy dan pemeriksaan bentrok

Pilih kalender secara eksplisit. Keluarkan kalender aplikasi dari query eksternal; agenda aplikasi dihitung dari database. Query 180 hari ke depan dengan batas coverage yang ditampilkan. Untuk kegiatan yang melewati batas awal/akhir, gunakan interval overlap dengan window, bukan hanya membandingkan tanggal mulai.

Result memuat checked_at, coverage_start/end, successful_calendar_ids, failed_calendar_ids, intervals dan stale_after. Error satu kalender menyebabkan partial, bukan aman. Tidak memilih kalender berarti pemeriksaan internal saja, bukan tidak ada bentrok eksternal. Cache lebih dari 15 menit stale. Tidak ada izin atau provider gagal tetap memungkinkan save lokal [S5].

Untuk interval half-open, overlap bila startA < endB dan startB < endA. Buffer before/after diterapkan konsisten pada internal dan external intervals. Date-only multi-day harus diperiksa terhadap rentang lokal setiap kegiatan, termasuk busy yang dimulai hari sebelumnya atau melewati midnight. DST nonexistent time ditolak dengan pesan; ambiguous time meminta pemilihan offset atau kebijakan eksplisit yang terlihat.

Tenggat berdekatan memakai window 48 jam sebagai pengaturan produk, bukan durasi kerja. Estimasi workload per minggu menjumlahkan job hours + competition estimate + bootcamp class/task; unknown ditampilkan sebagai komponen tak diketahui. Jangan menjumlahkan ulang blok Calendar yang merepresentasikan jam kerja yang sama. Maksimum pekerjaan 20 jam/minggu terpisah dari total_capacity null sampai pengguna menetapkannya.

## 8 Migrasi Calendar legacy

CareerCalendarSync.gs memakai CalendarApp pada primary, prefix [Career Tracker], dan menyimpan getId(). Apps Script getId adalah iCalUID, berbeda dengan Calendar REST event.id [S11]. Jangan langsung mengirim nilai legacy itu ke events.get sebagai eventId atau menghapus suffix untuk menebak ID.

Saat cutover, inventaris Calendar: Deadline ID, Follow-up ID, Announcement ID dan Registration/Submission ID. Simpan raw legacy ID, id_type=icaluid, calendar_ref=primary sebagai asumsi dari script yang harus dikonfirmasi, source sheet/column, dan waktu snapshot.

Default scope FreeBusy tidak memberi hak membaca detail legacy events. Pilihan aman adalah pengguna memeriksa dan menonaktifkan trigger script lama, meninjau agenda legacy, lalu memilih penanganannya sebelum publishing kalender baru. Bila migrasi programatis diperlukan, minta capability event read terpisah secara eksplisit dan gunakan lookup iCalUID untuk menemukan REST ID, verifikasi tanggal, record marker, organizer dan kalender. Tidak mengubah seluruh primary calendar hanya untuk migrasi.

Jika event legacy belum direkonsiliasi, tandai legacy_overlap_pending dan tahan publikasi ganda untuk milestone yang terkait. Jangan mengurangi busy interval yang mungkin berasal dari acara lain. Mematikan trigger tidak menghapus event lama; memindahkan jadwal ke kalender baru memerlukan keputusan terhadap event lama. Saat rollout selesai, hanya satu penulis Calendar yang aktif.

## 9 Kontrak Sheets dan riset

### Tiga mode import yang berbeda

| Mode | Field yang boleh masuk | Kontrol |
|---|---|---|
| initial_migration | Data publik dan pribadi existing yang dipetakan | Dry run, raw snapshot, legacy IDs, review enum/tanggal dan reconciliation |
| research | Hanya field informasi publik/evidence yang diizinkan | Sparse proposal, lock pengguna, no personal overwrite, dedup/run ledger |
| emergency_patch | Field tertentu yang dipilih pengguna dari ekspor | Base revision dan base value, server preview immutable, field-level apply, audit |

Sumber existing diatur via SHEETS_RESEARCH_SPREADSHEET_ID di server. JOBS_BOOTCAMPS dan COMPETITIONS adalah data entitas; due diligence/log/verification/history menjadi metadata pendukung. DASHBOARD/PIVOT/DAILY_REVIEW adalah hasil turunan, bukan entitas baru. Sheet data pribadi tidak disalin ke repository.

Header adalah otoritas pemetaan. Baca metadata, header, batas terpakai dan tipe/format cell. Jangan hardcode row 251 atau mengandalkan urutan kolom. Bila required header hilang/duplikat, simpan raw batch dan hentikan apply sampai mapping direview. Schema tambahan yang tidak dikenal disimpan sebagai raw extension, bukan dibuang diam-diam. Snapshot research diambil konsisten: bila batch/checksum atau run ID berubah saat read, baca ulang bounded snapshot sebelum preview.

Kolom penting: A Record ID adalah identitas legacy; Y Weekly Hours adalah ketersediaan pengguna dalam tracker lama, bukan employer requirement. AU Stated Weekly Hours adalah jam employer. O Recruitment Stage dan Q:X tanggal/tindakan pribadi dilindungi setelah cutover. AJ:CF berisi data riset. BL adalah skor, BC eligibility, BI posting status, BV run ID, BW dedup key. File mapping memuat semua 117 kolom.

Researching dipetakan ke stage saved dengan raw_stage dipertahankan. Awaiting Info dipetakan ke saved/awaiting_information sebagai detail tindakan, bukan applied. Closed / Expired pada eligibility lama dipisahkan menjadi posting_status closed_or_expired dengan evidence; jangan mengubah personal_stage menjadi rejected. Unknown literal, null dan angka 0 harus dibedakan.

### Deduplikasi dan merge

Utamakan external identity, kemudian official requisition ID + employer, lalu canonical official URL, kemudian candidate match employer/title/location/type/edition. Jangan merge otomatis berdasarkan judul semata. Bersihkan utm_*, fbclid dan tracking yang dikenal; pertahankan query parameter yang menentukan lowongan. Mirror sources digabung tanpa menghapus provenance. Edition/batch berbeda menjadi record berbeda.

Research payload bersifat sparse. Field absent berarti tidak ada usulan, bukan clear. Null berarti unknown yang dilaporkan sumber; tidak menghapus nilai user-confirmed. Explicit clear hanya dari keputusan pengguna atau verified source proposal yang diterima. Perubahan material pada deadline, lokasi, employer hours, eligibility dan publication status yang sudah reviewed masuk Inbox. Unknown baru tetap sah sebagai data baru yang belum dinilai.

Idempotensi batch memakai source_system + run_id + payload_hash. Run ID sama dengan hash berbeda harus conflict/quarantine, bukan overwrite silent. Per-item key/hash menghindari duplikat lintas batch dan memungkinkan retry hanya item failed. Empty import tidak menghapus seluruh data. Schema enforcement membuang/melaporkan personal field yang disisipkan research payload; nilai tersebut tidak pernah masuk apply.

Setiap hasil memuat reviewed, created, proposed_updates, applied_public_updates, unchanged, duplicate_candidates, quarantined, failed, dan personal_fields_ignored. Angka memiliki definisi dan tidak dijumlahkan ganda. Retry identik membuat zero domain changes; job attempt log boleh bertambah, change history field tidak.

### Automation yang sudah berjalan

Biarkan automation harian 08.00 WIB tetap menulis Sheets selama fase transisi. Website melakukan read/stage import via manual refresh dan scheduler berkala yang dikonfigurasi, misalnya setiap 15 menit jika layanan mendukung. Jangan hanya menjadwalkan satu impor 08.05 karena riset dapat selesai lebih lambat. Cursor/run hash mencegah pemrosesan ulang.

Prompt riset existing tetap mempertahankan kolom pribadi lama, tetapi setelah cutover kolom tersebut hanya snapshot lama, bukan master. UI website tidak menyatakan personal fields di tracker masih real-time. Penggantian automation ke endpoint website adalah P1 yang memerlukan kontrak terautentikasi, idempotency dan kapabilitas connector yang terbukti; jangan menanam token inbound di prompt automation atau menganggap ChatGPT dapat POST ke semua endpoint.

### Ekspor dan pemulihan

Ekspor native Sheets membuat file terpisah. Gunakan manifest, opportunity rows dan milestone rows terpisah, record/child IDs, revision, schema_version dan exported_at. Jangan menimpa workbook riset atau mengaktifkan two-way sync. Tulis valueInputOption RAW untuk data teks; cegah formula injection pada XLSX/CSV, termasuk whitespace/control prefix sebelum = + - @. File export dianggap lengkap hanya setelah seluruh batch sukses dan manifest completion ditulis.

Emergency patch menyertakan snapshot_id, entity_id, base_revision, field_path, base_value, proposed_value. Server menyimpan preview/hash; UI memperlihatkan old/current/proposed. Jika current revision berubah setelah preview, apply menghasilkan 409 dan preview ulang. Unknown ID tidak boleh dipasangkan melalui row number; create baru adalah aksi terpisah. Undo adalah compensating patch dengan pengecekan revisi, bukan rollback yang menimpa perubahan baru.

Google Sheets requests dibatch dan memakai retry/backoff untuk 429/5xx; quota dan batas payload aktual diperiksa pada dokumentasi saat setup. Per-tab protection tidak menggantikan kontrol backend file/field ownership [S7].

## 10 Capture dan ekstraksi

Simpan sumber terlebih dahulu. Jalankan structured JobPosting JSON-LD jika tersedia, kemudian parser label/rules; AI adapter opsional hanya jika key, consent pemrosesan data dan budget dikonfigurasi. Tidak perlu biaya LLM untuk core tracking. Evidence excerpt/hash, parser version dan checked_at tersimpan untuk setiap field proposal. Jangan menyamakan skor parser dengan verified eligibility.

Website publik HTTP/HTTPS saja. Blok localhost, private, reserved, link-local, metadata endpoints, credential-in-URL, port tidak diizinkan, redirect ke alamat internal, hostname encodings dan IPv4-mapped IPv6. DNS resolution harus diikat ke koneksi aktual atau gunakan fetch gateway dengan egress restriction; lookup terpisah bukan proteksi rebinding yang lengkap. Set batas ukuran compressed/decompressed, streaming read, redirect count dan total wall-clock timeout maksimum 60 detik; abort harus mencakup pembacaan body.

Konten HTML adalah data. Bersihkan sebelum render; larang executable HTML/script dan jangan ikuti instruksi dari job posting. Jika AI dipakai, schema output ketat dan tidak memiliki tool untuk apply, mengirim pesan atau membaca secret. Halaman login/CAPTCHA menggunakan fallback paste text. Hasil partial tidak menghilangkan draft. Belum ada OCR/PDF intelligence pada P0.

## 11 Scheduler dan observability

Worker cukup dalam codebase Next.js yang sama dengan outbox PostgreSQL. Scheduler dapat memakai Supabase Cron yang memicu protected HTTP worker atau scheduler hosting lain yang mampu cadence yang disyaratkan. Supabase Cron mendukung pemanggilan SQL/function/HTTP; verifikasi limits dan deployment aktual sebelum menjanjikan cadence [S9]. Jangan memakai setInterval di browser atau fire-and-forget promise serverless sebagai scheduler.

Cadence target: outbox ≤60 detik pada kondisi sehat, Calendar reconcile dan cache refresh sekitar 15 menit, Sheets polling sekitar 15 menit, backup harian. Ini target operasional PRD yang harus dibuktikan. Jika paket/deployment tidak mampu, status degraded dan konfigurasi manual terlihat; tidak dianggap lolos release gate integrasi. Task bounded memakai claim/lease/cursor dan tidak memegang HTTP request tanpa batas.

Health UI menampilkan configured/connected/last_success/last_attempt/next_attempt/pending_count/failed_count/coverage. Log hanya ID internal dan error code yang aman; redaksi token, body OAuth, notes pribadi dan contact. Metrik minimal: input duration, extraction success/partial/failure, calendar retries/conflicts, import no-op/failure, oldest pending job dan backup age.

## 12 Backup dan deployment

JSON export adalah portable data snapshot, bukan backup lengkap dengan token. Sertakan seluruh history secara paginated, seluruh entitas, schema version, manifest counts/checksums dan inventaris file; document objects dibackup terpisah dengan verifikasi checksum. Busy cache tidak diperlukan untuk restore; tokens tidak masuk export. Setelah restore, Google reconnect mungkin diperlukan.

Backup database dan private objects memakai mekanisme penyedia yang benar-benar dikonfigurasi. RPO/RTO 24 jam adalah target awal, bukan SLA atau janji paket gratis. Restore rehearsal ke database terpisah dengan integration writes disabled; bandingkan counts, IDs, relations, revisions, file inventory, dan cron state sebelum re-enable.

Deployment runbook harus memuat: migrations staging, owner provisioning, auth redirect URLs, env validation, OAuth config, private storage, cron secrets dan schedule, CI checks, health probes, backup/restore test, cutover review dan rollback. Preview/staging jangan memakai token/calendar/database produksi. Production data tidak otomatis dimigrasikan ketika menjalankan unit tests.

## 13 Konfigurasi dan secret

| Variabel | Tujuan | Client exposure |
|---|---|---|
| APP_URL | Origin canonical dan callback | Nilai URL boleh publik; validasi server |
| NEXT_PUBLIC_SUPABASE_URL | Endpoint project | Publik |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Client key dengan RLS | Publik; bukan service role |
| SUPABASE_SERVICE_ROLE_KEY | Worker yang memerlukan elevated DB access | Server only |
| DATABASE_URL | Migration/admin tooling bila dipakai | Server/CI secret only |
| OWNER_AUTH_USER_ID | Owner yang diizinkan setelah provisioning | Server only |
| OWNER_EMAIL | Bootstrap owner, jangan commit nilai pribadi | Server only |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | OAuth Web client | Secret server; ID tidak perlu dikirim sebagai config global |
| GOOGLE_REDIRECT_URI | Exact callback URL | Server validated |
| GOOGLE_TOKEN_ENCRYPTION_KEY / KEY_VERSION | AEAD key 32 byte base64 dan versi | Secret server, terpisah DB |
| SHEETS_RESEARCH_SPREADSHEET_ID | Workbook riset yang diizinkan | Server config privat |
| CRON_SECRET | Auth machine endpoint | Secret server/scheduler |
| INTEGRATION_WRITES_ENABLED | Off untuk test/restore/staging default | Server only |
| AI_PROVIDER / AI_API_KEY / AI_MONTHLY_BUDGET | Ekstraksi opsional | Secret server; default disabled |

App calendar ID dan export spreadsheet ID sebaiknya disimpan di integration metadata server, bukan diminta lewat form settings generik. .env.example hanya placeholder kosong. Validasi env saat startup/capability use dan tampilkan setup guidance tanpa membocorkan nilai. Jangan meminta user menaruh secrets di chat atau public GitHub.

## 14 Matriks uji integrasi

| ID | Skenario | Hasil wajib |
|---|---|---|
| INT01 | Token Google dicabut | needs_reconnect; save lokal tetap sukses |
| INT02 | Refresh token tidak dikirim saat consent tambahan | Token lama hanya dipertahankan untuk subject yang sama; scope state akurat |
| INT03 | Insert event timeout setelah provider berhasil | Retry menghasilkan satu event dengan mapping stabil |
| INT04 | 55 milestone dipublish | Seluruhnya terproses lewat batch/cursor, tidak berhenti di 50 |
| INT05 | Event diubah dan lokal juga berubah | Conflict, tidak ada silent overwrite |
| INT06 | Event remote dihapus | Review/tombstone; tidak auto recreate |
| INT07 | Opportunity gagal lolos atau diarsip | Future app events dibatalkan sesuai keputusan; histori tetap ada |
| INT08 | Calendar pribadi error satu dari tiga | Hasil partial dengan calendar gagal, tidak label aman |
| INT09 | Deadline tanggal saja | Transparent, tidak 23.59, tidak bentrok hard |
| INT10 | Batal satu recurring class | Hanya occurrence tersebut nonaktif |
| INT11 | syncToken 410 | Rebuild remote cache; data domain tidak hilang |
| INT12 | Same research run/hash diproses dua kali | Nol record baru dan nol field-change history pada retry |
| INT13 | Payload research menyisipkan stage/applied_at/notes | Field ditolak/ignored dan tercatat; personal state tetap |
| INT14 | Field research absent atau unknown | Tidak mengosongkan confirmed value |
| INT15 | Recovery stale dan preview tampering | 409/rejected; tidak menulis payload baru dari client |
| INT16 | Header Sheet reorder dan >251 rows | Mapping berbasis header dan used bounds tetap benar |
| INT17 | Kalender legacy iCalUID tersedia | Tidak dipakai sebagai REST ID; overlap pending sampai direkonsiliasi |
| INT18 | Backend restart setelah save sebelum sync | Outbox diproses ulang tanpa event ganda |
| INT19 | Export >300 history dan object files | Semua history dan inventory tercantum; restore terverifikasi |
| INT20 | User lain, forged headers dan file ID | Tidak memperoleh data atau menjalankan mutation |
| INT21 | SSRF redirect/DNS rebinding dan slow response body | Fetch ditolak/aborted; draft tetap tersimpan |
| INT22 | Acara lintas midnight/DST dan boundary window | Interval serta warning benar, termasuk overlap dari hari sebelumnya |
| INT23 | Sheets export dan research polling bersamaan | Tidak membaca ekspor sebagai temuan atau menimpa master |
| INT24 | Google belum dikonfigurasi | UI setup/degraded, adapter tests berjalan; tidak mengklaim live sync |

## Referensi primer

Referensi berikut diperiksa untuk desain pada 4 November 2026. Detail versi, quota dan kebijakan harus dicek ulang saat implementasi. Aturan merge, cadence target, release gates dan desain schema adalah keputusan proyek.

- S1 Google Calendar scopes: https://developers.google.com/workspace/calendar/api/auth
- S2 OAuth web server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- S3 Calendar events representation: https://developers.google.com/workspace/calendar/api/v3/reference/events
- S4 Incremental Calendar sync: https://developers.google.com/workspace/calendar/api/guides/sync
- S5 FreeBusy query: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- S6 Google Sheets scopes: https://developers.google.com/workspace/sheets/api/scopes
- S7 Sheets usage limits: https://developers.google.com/workspace/sheets/api/limits
- S8 Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- S9 Supabase Cron: https://supabase.com/docs/guides/cron
- S10 Google OAuth token expiration: https://developers.google.com/identity/protocols/oauth2#expiration
- S11 Apps Script CalendarEvent getId: https://developers.google.com/apps-script/reference/calendar/calendar-event#getId()
- S12 Next.js authentication: https://nextjs.org/docs/app/guides/authentication

## 15 Kontrak tambahan Hermes dan Telegram

HERMES_TELEGRAM_CONTRACT.md adalah kontrak normatif untuk agent API, token scopes, local MCP bridge, pemetaan empat tools dan deduplikasi capture. Endpoint agent berbagi service domain dengan endpoint website; otorisasi cookie website tetap terpisah dari bearer token agent.

Semua kontrak Google, Sheets, recovery, SSRF, owner isolation dan transaksi di bagian 1–14 tetap berlaku. Pengecualian scope: ekstraksi AI website opsional; percakapan Hermes memakai endpoint model lokal dengan anggaran API Rp0, tanpa fallback cloud. Hermes tidak memiliki Google token, service-role DB, akses ekspor penuh atau write Calendar. Core backend hanya menyediakan data yang dibutuhkan empat tool yang disetujui.

Scheduler Google/Sheets/backup tetap milik tracker. Hermes cron untuk riset/digest/reminder dinonaktifkan pada pilot. H01–H24 pada ACCEPTANCE_TEST_PLAN.md adalah pengujian tambahan, bukan pengganti INT01–INT24. Konfigurasi contoh dalam examples adalah target yang masih harus diimplementasikan, bukan tanda endpoint sudah tersedia.


## Histori riset harian dan batas impor

WP05 menyimpan snapshot run immutable dengan identitas (owner, source_system, run_id), timestamp sumber beserta zona, jumlah reviewed, new, existing_enriched, total per klasifikasi, high_priority_active, coverage dan limitations. Lampirkan relasi (run_id, legacy_record_id, action, checked_at, source_ref) untuk item yang memiliki bukti pemeriksaan. Nilai yang tidak dilaporkan disimpan null; jangan mengisi checked_at untuk carry-forward. Simpan waktu impor terpisah dari waktu riset.

Parser DAILY_RESEARCH_LOG mengenali baris run melalui Run ID dan tipe kolom; baris Search batch, S1 dan sejenisnya dikeluarkan dari hitungan. Simpan log asli sebagai provenance. Bila detail lama sudah tertimpa, tandai item historis tidak tersedia dan pertahankan agregat sumber; jangan merekonstruksi perubahan dari posisi baris. Replay payload yang sama adalah no-op. Jika run ID sama dengan hash berbeda, buat versi koreksi untuk review dengan tautan ke snapshot awal. Import parsial belum boleh ditandai selesai. Ringkasan per run dibaca owner pada Inbox. Empat tool MCP pilot tetap sesuai kontrak.

Uji rekonsiliasi R01–R05 di ACCEPTANCE_TEST_PLAN.md. Bukti historis privat ada pada RESEARCH_RUN_RECORD.md; gunakan hanya fixture sintetis di CI.
