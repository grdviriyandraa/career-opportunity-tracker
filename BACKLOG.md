# Backlog Implementasi Codex

Versi 3.2 | Semua paket awal NOT_STARTED | S/M/L adalah kompleksitas relatif, bukan estimasi jam.

## WP00 Audit dan fondasi keputusan

P0 | S | Dependency: tidak ada | Peran: engineering/PM.

Periksa AGENTS.md yang berlaku, repo, branch, perubahan lokal, package manager, CI dan sumber referensi. Re-audit repo walau snapshot terakhir kosong. Pilih stack default Next.js/TypeScript/Supabase dengan ADR jika berubah. Siapkan folder dokumentasi tersanitasi dan strategi branch. Petakan field personal agar tidak masuk repo public.

Acceptance: baseline commit atau empty state tercatat, tidak overwrite pekerjaan, dependency pin/lockfile diputuskan, status awal setiap WP jujur. Deliverable: ADR-001, file map, STATUS.md awal. Gate G0; FR41.

## WP01 Auth database dan transaksi

P0 | L | Dependency: WP00 | Peran: backend.

Implementasikan owner auth, RLS, domain schema, migrations, constraint/index, audit/outbox transaction dan environment validation. Pisahkan sesi website, Google OAuth grant dan credential agent. Buat fixture sintetis dan test DB nyata lokal bila tersedia.

Acceptance: unauth/other owner/spoofed header ditolak; fresh migration dan transaction rollback lulus; UI disconnected jujur. Deliverable: migrations, auth tests, environment template, CI. FR01, FR28, FR30, FR40, FR41; INT20/24.

## WP02 Alur produk dan capture bersama

P0 | L | Dependency: WP01 | Peran: frontend/backend.

Bangun tujuh menu, list/detail, filter, form bertahap, actual action/undo, archive/restore, provenance, dedup exact identity, unknown dan capture sebelum fetch. Service capture menjadi jalur bersama web/agent. UI mobile 390 px, keyboard, loading/empty/retry.

Acceptance: satu link cukup menyimpan; source fetch gagal tidak menghapus draft; closed tidak rejected; URL job ID tidak hilang; transaksi concurrent capture aman. Deliverable: vertical slice + E2E desktop/mobile. FR02–08, FR26–29, FR42; INT13/14/21.

## WP03 Agenda dan waktu

P0 | L | Dependency: WP02 | Peran: domain/frontend.

Milestone dinamis, DATE versus instant, zona IANA, recurrence/exception, attendance, workload tanpa double count dan conflict engine. Unknown tidak menjadi midnight/23.59. Deadline query API agent kelak membaca domain ini.

Acceptance: interval boundary, buffer, DST, conditional final, date-only, recurrence cancel dan coverage window lulus. Deliverable: unit fixtures, agenda UI dan projection tests. FR09–14, FR18–20, FR33; INT09/10/22.

## WP04 Google Calendar dan worker

P0 | L | Dependency: WP01/WP03 | Peran: integrasi.

OAuth dengan identity/state/scopes, encrypted refresh tokens, FreeBusy selected calendars, app-created calendar, stable event mapping, ETag conflicts, retry/pagination/outbox, real scheduler dan health UI. Rekonsiliasi Calendar legacy sebelum penulis baru aktif.

Acceptance: seluruh Calendar INT relevan lulus; mock dan live dibedakan; >50 event, remote delete, token revoke dan restore isolation teruji. Deliverable: adapter, setup Google, cutover checklist dan evidence. FR14–20, FR28, FR31–35, FR39/40; INT01–11/17/18/24.

## WP05 Sheets migrasi ekspor dan pemulihan

P0 | L | Dependency: WP01/WP02 | Peran: data/integrasi.

Mapping 117 headers dinamis, import mode terpisah, run/item ledger, sparse proposals, protected personal fields, emergency preview immutable, complete export/history/object inventory, backup dan restore drill. Re-read Sheet metadata sebelum migrasi nyata.

Acceptance: replay no-op, Y/AU tidak tertukar, >251 rows, stale preview/tampering ditolak, >300 history diekspor, restore tanpa Google writes. Deliverable: reconciliation report, recovery tests dan runbook. FR21–27, FR35–40; INT12–17/19/23.

## WP06 Agent API dan credential

P0 | M | Dependency: WP01/WP02; deadline read WP03 | Peran: backend/security.

Implementasikan empat routes pada HERMES_TELEGRAM_CONTRACT.md, token mint/hash/scope/expiry/revoke, Settings credential management, projection data minimal, pagination dan rate limit. Owner selalu berasal dari credential. Backend menolak semua mutation yang tidak diizinkan.

Acceptance: revoked/expired/wrong scope ditolak; kontak/token/file privat tidak keluar; create_draft memakai service bersama; status/revision/freshness akurat. Deliverable: schema/API contract, real DB integration tests dan receipt. FR43–48, FR52/54; H03–H10/H14/H22–24.

## WP07 Local MCP bridge

P0 | M | Dependency: WP06 | Peran: integrasi.

Bangun tools/tracker-mcp berbasis stdio, typed schema empat tools, auth token-file, fixed origin, durable intent ledger, bounded timeout/retry, sanitized stderr, Windows path handling dan build:mcp. Tolak argumen arbitrer termasuk owner/header/URL backend. Ledger tidak berisi bot/provider secrets.

Acceptance: tepat empat tools ditemukan; restart setelah timeout tidak duplicate; HTTP non-loopback ditolak; no secret stdout; schema error tertangani. Deliverable: build, example config aktual, contract harness. FR45–50, FR52/54/55; H04–H16/H20/H22–24.

## WP08 Hermes Telegram dan evaluasi jawaban

P0 | M | Dependency: WP07; live provider/bot oleh owner | Peran: integrasi/QA.

Siapkan Windows native runbook, private-only transport/allowlist, efektif tool filtering, prompt behavior, setup Ollama lokal, uji H19 tanpa fallback cloud dan uji intent. Jangan mengaktifkan shell/cron/research/Google/GitHub/Codex via chat. Adaptasi nama config mengikuti versi terpasang tanpa menebak.

Acceptance: owner chat berhasil, stranger/grup ditolak; fakta tracker dari tool; write progres ditolak; unknown/ambiguous/partial jujur; 20 Q&A fixtures dievaluasi. Deliverable: konfigurasi tersanitasi, eval results dan live smoke owner. FR43–56; H01/02/11–21.

## WP09 UAT integrasi dan perbaikan

P0 | M | Dependency: WP02–WP08 | Peran: QA/review.

Jalankan traceability FR01–56, INT01–24 dan H01–24. Uji alur Telegram capture -> Inbox -> review website -> milestone -> Calendar, dengan perubahan Calendar hanya setelah tindakan website yang sah. Uji cross-channel concurrency, grant revoke, backend outage dan restart.

Acceptance: semua P0 yang akan dirilis passed dengan bukti; blockers eksplisit; tidak ada klaim live dari mocks. Deliverable: test report, redacted evidence, fixed defects dan daftar keterbatasan. Gate G5.

## WP10 Handoff operasi dan release

P0 | M | Dependency: WP09; deploy/cutover keputusan owner | Peran: engineer/PM.

Perbarui README/setup sesuai implementasi aktual, runbook start/stop/rotation/rollback, restore report, status integrasi, dependency versions dan changelog. Siapkan branch/PR dengan deskripsi hasil serta validasi. Repo publik hanya menyimpan dokumen aman dan synthetic fixtures.

Acceptance: clean checkout bisa dibangun; owner dapat mengikuti runbook; semua artifact terhubung; rollback target ada; tidak merge/deploy tanpa instruksi release. Deliverable: PR/commit atau patch lokal jika push tidak tersedia, release evidence, backlog lanjutan. FR41/55/56.

## Backlog berikutnya yang belum disetujui untuk implementasi

P1-01 update progres/jadwal lewat Telegram dengan preview, expected_revision dan confirmation nonce. P1-02 digest/reminder Telegram dengan outbox, TTL, quiet hours dan dedup lintas kanal. P1-03 riset web lewat Hermes dengan sumber, freshness, batas biaya dan ingestion review. P1-04 hosting Hermes 24/7. P1-05 voice/poster/PDF. P2-01 coding melalui Telegram atau multi-user. Semuanya perlu delta scope dan acceptance baru; kemampuan bawaan provider bukan persetujuan mengaktifkannya.


## Tambahan acceptance per paket untuk riwayat riset

WP05 menyimpan snapshot dua run dan relasi item sesuai kontrak, kemudian menampilkan ringkasan pada Inbox. WP08 menguji perbedaan status pribadi, status posting dan kelayakan dengan pertanyaan Telegram. WP09 bertanggung jawab atas R01–R05 serta pembandingan sebelum/sesudah replay. G2 membutuhkan bukti R01–R04, G4 membutuhkan R05 bersama hasil uji live owner. Template bukti memuat commit, fixture, hasil aktual, selisih dan status.
