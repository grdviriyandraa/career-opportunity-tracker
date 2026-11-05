# Bridge MCP lokal — checkpoint implementasi

Bridge stdio dapat dibangun dan diuji tanpa Supabase, Hermes, model atau Telegram. SDK resmi `@modelcontextprotocol/sdk@1.32.2` dipin pada dependency root dan satu package-lock. Runtime yang diuji Node 24.22.1; bridge memakai SQLite bawaan Node dan memerlukan Node >=22.13 dengan dukungan `node:sqlite`. Node dapat menulis experimental warning SQLite ke stderr; stdout tetap khusus protokol MCP.

**Batas:** backend `/api/agent/*`, Settings credential, scopes/expiry/revocation dan rate limit WP06 kini tersedia dan diuji bersama bridge melalui website serta PostgreSQL sintetis. Migrasi agent belum diterapkan hosted. Cookie website atau key Supabase bukan credential bridge. Pilot Telegram, Windows, hosted Auth dan restore tetap pending; H01–H24 belum lulus keseluruhan. Lihat [API agent](AGENT_API.md).

## Build dan verifikasi

Dari root repository:

```sh
npm ci
npm run build:mcp
npm test
```

Output ada di `tools/tracker-mcp/dist/` (di-ignore Git). `npm test` membangun CLI terlebih dahulu lalu menjalankan Vitest. Lint mencakup source bridge; typecheck mencakup config NodeNext bridge dan aplikasi. Contract harness menjalankan mock HTTP loopback, official SDK client/stdin-stdout child process serta ledger sementara di luar repository. Tests tidak membuka port publik atau menghubungi backend hosted.

## Konfigurasi trusted

| Variabel                    | Nilai konfigurasi                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| TRACKER_ORIGIN              | Origin website, tanpa path/query/hash/user/password. Hosted wajib HTTPS.                                 |
| TRACKER_TOKEN_FILE          | Path absolut file credential integrasi opaque, di luar repository. Bukan token dalam env/argumen.        |
| TRACKER_LEDGER_FILE         | Path absolut file SQLite khusus integrasi ini, di luar repository. File tidak berisi payload atau token. |
| TRACKER_ALLOW_LOOPBACK_HTTP | `1` hanya untuk development dengan hostname tepat 127.0.0.1, localhost atau [::1].                       |

Jalankan `node tools/tracker-mcp/dist/index.js` sebagai child process MCP setelah konfigurasi trusted disiapkan. Tidak perlu menjalankan server HTTP MCP atau membuka inbound port. Pada Windows, pakai path absolut Node dan file JS hasil build bila working directory Hermes berbeda. Path credential/ledger mendukung spasi karena tidak dipecah atau diproses melalui shell.

File credential berisi satu token opaque base64url minimal 43 karakter, tanpa whitespace internal, maksimal 512 karakter. Format ini mempertahankan batas desain token acak minimal 256 bit; entropi sebenarnya wajib dijamin backend penerbit. Prefix key Supabase ditolak agar tidak tertukar. Token dibaca ulang tiap request untuk rotasi file, tidak diterima dari model, tidak disimpan pada ledger dan tidak dicetak. Pada POSIX, file token/ledger harus hanya dapat diakses owner (0600), file symlink ditolak dan direktori baru dibuat 0700. Pada Windows, atur ACL file dan direktori melalui akun pengguna sebelum pilot; bridge tidak mengklaim memvalidasi ACL Windows.

Jika runtime wajib melewati proxy, **pertahankan proxy dan CA trust environment**. Node 24.22.1 yang diuji menyediakan `--use-env-proxy`; gunakan `node --use-env-proxy .../dist/index.js` pada environment semacam itu, dengan HTTP_PROXY/HTTPS_PROXY/NO_PROXY yang sudah dikonfigurasi oleh platform. Jangan menghapus proxy atau mematikan TLS verification. Flag ini tidak diasumsikan tersedia pada semua minor Node 22. Harness loopback lokal tidak memerlukan koneksi Internet.

## Empat tool dan batas input

Discovery memuat tepat `search_opportunities`, `get_opportunity`, `get_upcoming_deadlines`, `create_draft`. Semua object input strict dengan additionalProperties=false; actual runtime schema tetap memeriksa refinement yang tidak sepenuhnya diwakili JSON Schema discovery.

- Search: query <=200, kategori/stage/arrangement enum, employer hours 0–168, boolean include_unknown_hours, cursor <=1024, limit 1–20. Tidak ada coercion string ke number/boolean.
- Detail: satu opportunity_id UUID.
- Deadlines: tanggal kalender valid, awal/akhir inklusif maksimal 31 hari (selisih <=30), kategori/cursor opsional, limit 1–50. Tidak memeriksa kalender pribadi atau menjanjikan jadwal bebas.
- Draft: minimal URL HTTP(S) tanpa credential, source_text atau title yang tidak kosong; kategori opsional tetap unclassified bila kosong. URL <=2048, text <=20000, title <=300. Unicode harus well-formed; JSON UTF-8 total <=64 KiB. Model tidak mengendalikan key, owner, actor, token, origin, headers atau method.

Permintaan URL sumber tidak pernah di-fetch oleh bridge. Pembacaan dan draft hanya diarahkan ke empat route fixed di kontrak. Tidak ada SQL/shell/arbitrary HTTP/progress mutation/Calendar/coding tool pada MCP ini. Larangan tool tidak menggantikan otorisasi backend WP06.

## Transport, projection dan error

Setiap attempt timeout 15 detik termasuk pembacaan response. Maksimal dua retry untuk network/timeout/429/5xx dengan jitter dan Retry-After. Retry-After >30 detik dilaporkan BACKEND_BUSY untuk mencegah penantian tak terbatas. Redirect tidak diikuti; 400/401/403/409 tidak di-retry otomatis. Response JSON dibatasi 64 KiB baik declared length maupun streamed bytes.

Respons sukses wajib sesuai envelope/projection bridge. Field tak dikenal seperti notes/contact/token dibuang; null, partial, next_cursor dan source timestamps dipertahankan. app_url wajib berasal dari trusted origin dan path `/opportunities/{UUID}`, tanpa query/hash/credential. Token yang direfleksikan backend ke field allowlist juga ditolak. Detail mendukung requirements/compensation berupa string terbatas; backend adapter nanti harus cocok dengan projection ini. Respons backend malformed tidak diteruskan sebagai fakta tracker.

Error tidak mengembalikan body/headers/exception backend. MCP mengirim code aman dan retryable; draft gagal berstatus capture_status=unconfirmed. Startup hanya mencetak satu petunjuk generik ke stderr. SDK menangani framing/initialization; SIGTERM, SIGINT dan stdin EOF menutup koneksi/ledger secara idempotent, membatalkan HTTP aktif dan meninggalkan intent belum terkonfirmasi untuk rekonsiliasi.

## Ledger intent dan restart

SQLite lokal memakai synchronous=full dan transaksi singkat sebelum HTTP capture. Baris pending hanya memuat SHA-256 payload tervalidasi, UUID idempotency key dan waktu dibuat; tidak menyimpan URL, teks, receipt, token bot, model/provider key atau database credential. Key dipersist sebelum request dikirim. Retry atau resubmission payload sama setelah restart memakai key pending sama. Simultaneous identical calls dalam satu proses berbagi request in-flight.

Receipt valid menghapus pending intent; permintaan baru setelah hasil diketahui boleh mendapat key baru dan backend tetap wajib melakukan dedup identitas domain. Timeout, 5xx, receipt malformed atau kegagalan lain mempertahankan pending. Tidak ada auto-expiry pending: retensi minimum tujuh hari terpenuhi tanpa menghapus intent belum terkonfirmasi. Maksimal 1.000 pending intent; kapasitas penuh gagal tertutup tanpa eviction. SQLite memberi atomic commit dan recovery crash, tanpa lockfile proses buatan sendiri.

Gunakan ledger khusus untuk origin/owner/integration yang sama. Jangan mengganti konfigurasi ke backend/owner lain atau menghapus ledger untuk melewati pending capture. Payload tidak disimpan, jadi setelah restart resubmit isi asli untuk rekonsiliasi key. Bridge tidak mempunyai trusted Telegram message/update ID dan tidak mengarang atribusi transport. Backend baru menguji receipt/idempotensi, dedup lintas kanal dan revoked/expired/wrong-scope denial secara lokal. Acceptance hosted, concurrency multi-connection nyata dan restore isolation tetap pending.
