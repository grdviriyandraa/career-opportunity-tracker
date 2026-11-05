# Career Opportunity Tracker Handoff Versi 3.2

5 November 2026 | Pemilik produk Gerard Viriyandra | Repository https://github.com/grdviriyandraa/career-opportunity-tracker

Tujuan paket: menyerahkan implementasi website dan integrasi Hermes–Telegram kepada Codex dengan keputusan produk, batas kewenangan, tugas, pengujian dan panduan operasional yang jelas. Ini paket spesifikasi dan referensi; bukan aplikasi siap dijalankan.

## Mulai di sini

1. Simpan paket ini di folder privat di luar repository. Buka repository target dalam Codex.
2. Baca ringkasan keputusan di bawah; salin instruksi sesudah pemisah pada PROMPT_CODEX.md. Beri Codex lokasi folder handoff yang benar-benar dapat dibaca.
3. Codex melakukan WP00, kemudian mengikuti BACKLOG.md. Gunakan CODEX_TASK_PROMPTS.md jika ingin mengerjakan satu paket tugas per sesi.
4. Setelah adapter tersedia, ikuti SETUP_HERMES_TELEGRAM_CODEX.md. Langkah yang membutuhkan kode akan ditandai; instalasi Hermes dan bot saja belum menghubungkan tracker.
5. Uji berdasarkan ACCEPTANCE_TEST_PLAN.md dan simpan bukti pada template STATUS.md serta RELEASE_EVIDENCE.md. Jangan mengisi passed dari rencana.

## Keputusan yang sudah dikonfirmasi

Windows tanpa WSL; Hermes lokal dahulu; bot Telegram baru; model lokal, anggaran API Rp0; baca tracker dan simpan draft; Codex khusus membangun aplikasi. Website tetap pusat pengelolaan data. Chat umum diperbolehkan, riset internet baru dan write progres via Hermes belum termasuk. Notifikasi kritis tetap mengikuti website/Calendar; Telegram proaktif P1.

## Isi dan otoritas dokumen

| File | Kegunaan |
|---|---|
| PRD_Pengelola_Peluang_v3_2.md dan .docx | Scope produk dan FR01–FR56 |
| IMPLEMENTATION_HANDOFF.md | Bukti historis, audit repo terkini dan gap |
| INTEGRATION_CONTRACTS.md | Google, Sheets, model data, recovery, INT01–INT24 |
| HERMES_TELEGRAM_CONTRACT.md | Empat tool, token, API, idempotensi, boundary runtime |
| SETUP_HERMES_TELEGRAM_CODEX.md | Langkah Windows, bot, provider, bridge, Codex dan verifikasi |
| PROJECT_DELIVERY_PLAN.md | Tujuan, peran, urutan kerja, gate dan cara pelaporan |
| BACKLOG.md | Paket tugas dengan dependency, acceptance dan hasil serah terima |
| ACCEPTANCE_TEST_PLAN.md | Traceability 56 FR serta 24 uji agent tambahan |
| DECISIONS_AND_RISKS.md | Keputusan, pertanyaan terbuka, risiko dan trigger tindakan |
| OPERATIONS_RUNBOOK.md | Start/stop, kegagalan, revoke, update dan rollback |
| PROMPT_CODEX.md | Instruksi utama implementasi |
| CODEX_TASK_PROMPTS.md | Prompt per tahap dan review |
| templates/ | AGENTS, status, ADR, PR, issue dan release evidence |
| examples/ | Konfigurasi, schema dan payload sintetis; belum implementation |
| SHEETS_FIELD_MAPPING.csv | 117 header baseline; baca header live saat migrasi |
| reference_partial_source/ | Source v2 terpilih, parsial, tidak runnable mandiri |
| SOURCES_AND_VERSION_NOTES.md | Dokumentasi primer dan batas verifikasi |
| RESEARCH_RUN_RECORD.md | Dua run terverifikasi terhadap log dan delapan perubahan pada 5 November; khusus pemilik |
| examples/research_history.synthetic.json | Dataset buatan untuk pengujian R01–R05 |
| PACKAGE_MANIFEST.json | Inventaris dan checksum file |

Instruksi pengguna terbaru mengungguli paket. PRD menentukan scope; kontrak menentukan perilaku teknis; backlog menentukan urutan. Konflik diselesaikan melalui decision log sebelum perubahan yang terpengaruh. Source parsial bukan otoritas spesifikasi.

## Status dan privasi

Audit Contents API 5 November 2026 masih menemukan repo kosong. Build/typecheck pada handoff lama hanya berlaku untuk source Vinext historis. Dokumen v3 dibuat dan diperiksa, tetapi aplikasi, MCP, OAuth, Telegram dan deployment belum diimplementasikan atau diuji live pada pekerjaan ini.

Paket mengandung konteks pribadi dan alamat tracker. Jangan commit seluruh ZIP atau dokumen privat ke repo public. Codex menyalin hanya spesifikasi yang disanitasi, template aman dan fixture sintetis; jangan memasukkan secret, isi tracker, CV, dump DB atau session Hermes. Model lokal, hosting, akun Google dan kredensial disiapkan secara lokal pada setup; jangan kirim token melalui percakapan.
