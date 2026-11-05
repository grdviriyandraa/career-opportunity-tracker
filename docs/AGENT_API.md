# API agent dan credential Hermes

WP06 menyediakan backend baca/draft dan pengelolaan credential di Settings. Diuji dengan PostgreSQL PGlite dan website/bridge MCP melalui transport Auth/PostgREST sintetis. Migrasi `20261105151101_agent_api.sql` **belum diterapkan ke Supabase hosted**. OTP/session hosted, restore isolation, Hermes Windows, Ollama dan Telegram tetap gate terpisah. Tidak ada panggilan model atau fallback cloud dalam fitur ini.

## Setup dan credential

Pada project development existing, kedua migrasi core/research sudah diterapkan. Tinjau history dan terapkan hanya migrasi agent melalui workflow Supabase yang disetujui. Jangan mengulang migrasi lama atau memuat fixture pribadi/sintetis ke hosted. Tidak ada perubahan/publish environment yang diperlukan.

Owner masuk ke website, membuka Settings, lalu memilih label, subset scope dan masa berlaku 1–30 hari. Scope tepat `opportunities:read`, `agenda:read`, `drafts:create`; maksimal 10 credential aktif. Token acak 256 bit dihasilkan server dan ditampilkan sekali. Simpan ke file privat di luar repository sesuai [panduan bridge](MCP_BRIDGE.md). Bila hasil penerbitan hilang, cabut credential melalui metadata dan buat penggantinya. Jangan memasukkan token ke chat, prompt, log, YAML atau argumen command.

Database menyimpan SHA-256, prefix delapan karakter dan metadata, tanpa token asli. `GET /api/integrations/hermes` mengembalikan metadata; `POST` menerbitkan token; `DELETE /api/integrations/hermes/{UUID}` mencabutnya. Semuanya memerlukan sesi owner. Mutation memerlukan Origin canonical. Authorization bearer ditolak pada kanal website walaupun disertai cookie owner. Respons credential memakai Cache-Control private/no-store. Daftar dibatasi 100 metadata terbaru.

Settings menampilkan status saat daftar dimuat, expiry dan penggunaan terakhir yang berhasil. Tombol muat ulang memperbarui status. Tidak ada heartbeat atau klaim bot online. Last API result/audit operasional lengkap belum tersedia; kegagalan scope/expiry/rate tidak memperbarui last-used.

## Empat endpoint

| Endpoint | Scope | Input |
| --- | --- | --- |
| GET `/api/agent/opportunities` | opportunities:read | query, category, stage, arrangement, max_employer_hours, include_unknown_hours, cursor, limit 1–20 |
| GET `/api/agent/opportunities/{UUID}` | opportunities:read | Satu peluang aktif; archived/tidak ditemukan menghasilkan 404 |
| GET `/api/agent/deadlines` | agenda:read | start_date/end_date inklusif maksimal 31 hari, category, cursor, limit 1–50 |
| POST `/api/agent/drafts` | drafts:create | URL/teks/judul dan category opsional; Idempotency-Key UUID wajib |

Schema input dipakai bersama bridge. Query key ganda, field tak dikenal/owner/progres, tipe/tanggal tidak valid dan payload >64 KiB ditolak. Boolean query hanya true/false. Token berasal dari header Authorization Bearer, bukan cookie/query. Respons dibatasi 64 KiB dan tidak di-cache. Tidak ada endpoint agent untuk progres, export, file, Google, SQL, terminal atau deployment.

Envelope read mempertahankan unknown/null, next_cursor, warnings dan partial. app_url berasal dari APP_URL server. Proyeksi tidak mengirim notes, source_text, owner ID, kontak atau file. Evidence saat ini array kosong: waktu query bukan verifikasi ulang sumber. Requirements/compensation dan provenance publik lengkap belum tersedia. Arrangement/remote_eligibility nullable; record existing tidak diisi fakta default. Form kategori lengkap tetap pekerjaan terpisah.

Pagination memakai UUID berurutan, bukan urutan deadline/kronologi. Cursor memuat posisi dan hash filter tervalidasi, tanpa credential. Perubahan filter/limit dengan cursor lama menghasilkan 400. Antarpage bersifat sequential, bukan snapshot atomik; next_cursor harus diikuti sebelum menyebut hasil lengkap. Date-only tetap tanpa jam; instant disaring menurut tanggal Asia/Jakarta. Deadline tool tidak memeriksa FreeBusy.

## Otorisasi dan transaksi

Route agent memakai client Supabase anonymous baru dengan publishable key, tanpa cookie/JWT website. RPC agent_read dan agent_capture tersedia bagi role anon tetapi memvalidasi token mentah, hash, scope, expiry, revocation, profile dan status Auth owner (banned/deleted), serta rate limit di database. Hash tersimpan tidak dapat dipakai sebagai bearer. Tabel credential/receipt menolak akses langsung anon/authenticated dan memakai RLS tanpa policy publik. Helper privat dan public SECURITY DEFINER RPC memakai search_path kosong serta explicit EXECUTE grants. Tinjau advisors saat migrasi hosted; jangan memperluas grant untuk menghilangkan error. Tidak diperlukan service-role key.

Token mentah hanya diteruskan sebagai parameter RPC; jangan mengaktifkan pencatatan Authorization, body atau parameter RPC pada middleware/tracing. Metadata bukan secret. Credential management menggunakan authenticated owner guard existing. Pemanggilan Data API langsung juga memeriksa scope/revocation/rate, bukan hanya route HTTP.

Rate limit per credential: 30 read/menit dan 10 capture/menit, fixed minute window dan row lock database. Replay tetap dihitung. HTTP429 mempunyai Retry-After 60 detik. Bridge dapat mengembalikan BACKEND_BUSY karena batas penantiannya 30 detik. Rate counter dan last-used hanya menetap pada RPC berhasil.

Website dan agent memakai tracker_private.persist_draft yang sama. Normalisasi URL pada kedua route memakai canonicalUrl: tracking dibuang, query identity dipertahankan. Owner lock dan unique identity mencegah duplikasi standar lintas kanal. Receipt agent berkey `(owner_id, integration_id, idempotency_key)`, dengan payload hash dan hasil dalam transaksi draft/audit/outbox. Replay identik HTTP200; payload berbeda dengan key sama HTTP409. Created baru HTTP201. Duplikat URL tidak menimpa stage, notes, actual_date atau revision existing dan tidak menambah audit/outbox domain. Actor agent hermes_integration tidak mengarang Telegram message ID.

Receipt tidak memiliki auto-expiry (retensi setidaknya 30 hari); housekeeping ukuran penyimpanan belum dijadwalkan. SQLite bridge mempertahankan pending intent minimal tujuh hari. Draft committed tidak menunggu fetch/AI dan tidak membuat Calendar event; outbox extraction_manual_required tetap blocked. Uji kegagalan audit membuktikan draft, receipt, outbox dan usage counter ikut rollback.

## Bukti dan gate live

19 uji baru memeriksa otorisasi/scopes/expiry/revoke/banned/deleted, hash replay denial, grants/role isolation, rate limits, cross-channel dedup, receipt replay/conflict, proyeksi, unknown hours, paging, tanggal deadline dan rollback. Dua scenario browser desktop/390px menjalankan owner login sintetis, penerbitan token di Settings, SDK MCP stdio dengan keempat tool ke API yang diimplementasikan, lalu revoke; website tetap berfungsi. Semua akun, token dan data pengujian sintetis.

Migrasi agent hosted dan credential nyata belum dibuat. Public signup masih aktif pada pemeriksaan terakhir; OTP delivery/session belum terverifikasi. Lengkapi gate hosted dan restore sebelum memakai grant dengan data pribadi, lalu jalankan pilot Windows/H19 dengan model lokal, biaya API Rp0 dan tanpa cloud fallback.
