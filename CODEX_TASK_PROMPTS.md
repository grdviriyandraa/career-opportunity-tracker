# Prompt Delegasi per Tahap

Gunakan PROMPT_CODEX.md untuk konteks penuh. Prompt berikut dipakai pada sesi lanjutan dengan folder handoff yang sama. Ganti path lokal secara nyata; jangan mengklaim file terlampir bila tidak tersedia.

## Mulai proyek

```text
Baca AGENTS.md repo dan paket handoff v3.2 pada <PATH_HANDOFF_PRIVAT>. Kerjakan WP00, kemudian WP01–WP02 sampai vertical slice login owner -> capture draft -> Inbox/detail -> persistence bisa diuji. Repo target grdviriyandraa/career-opportunity-tracker. Pertahankan pekerjaan existing; baseline audit kosong bukan izin overwrite. Gunakan PRD v3.2 dan kontrak sebagai acuan, synthetic fixtures saja. Lanjutkan implementasi setelah audit singkat. Catat command/test/result aktual di STATUS.md; blocked credentials tidak berarti semua pekerjaan harus berhenti.
```

## Bangun integrasi Google dan data

```text
Lanjutkan WP03–WP05 pada branch saat ini setelah memeriksa git status dan checkpoint. Ikuti FR09–42 dan INT01–24. Implementasikan agenda, presisi waktu/recurrence, OAuth/FreeBusy/Calendar outbox, ingestion Sheets berbasis 117 headers, recovery preview dan restore. Uji idempotensi, concurrency, >50 events, personal field protection, >300 history dan legacy iCalUID. Pisahkan mock dan live evidence. Jangan mengaktifkan penulis Calendar baru sebelum cutover legacy terverifikasi.
```

## Bangun agent API dan MCP

```text
Kerjakan WP06–WP07 berdasarkan HERMES_TELEGRAM_CONTRACT.md. Implementasikan scoped token settings, empat agent routes, local stdio bridge tools/tracker-mcp dan build:mcp. Tool: search_opportunities, get_opportunity, get_upcoming_deadlines, create_draft. Gunakan service domain yang sama dengan website; jangan memberi bridge DB service role atau Google token. Persist capture intent sebelum request; replay key sama setelah timeout/restart. Buat schema strict, projection minimal, pagination, expiry/revoke dan cross-channel dedup test. Config contoh harus diperbarui sesuai kode yang benar-benar dibangun.
```

## Sambungkan Hermes dan Telegram

```text
Kerjakan WP08 tanpa meminta secret dikirim dalam chat. Target Windows native, bot baru, private owner, model lokal, anggaran API Rp0. Siapkan runbook sesuai versi Hermes aktual; bantu owner menyiapkan Ollama, mencocokkan konteks dan membuktikan tool calling plus H19. Pastikan Telegram effective tools tidak mencakup shell, file, web research, cron, Google/GitHub atau Codex runtime. Verifikasi empat MCP tools dan uji H01–24 yang tersedia. Jika model lokal/bot belum dikonfigurasi, selesaikan mock/config checks lalu tandai live gate BLOCKED; jangan menyebut koneksi selesai.
```

## Review dan release readiness

```text
Review implementasi terhadap FR01–56, INT01–24 dan H01–24. Fokus: auth owner, scope agent, unknown/freshness, capture replay/concurrency, Calendar double writer, source injection, restore grant revoke dan kebocoran data ke repo public. Jalankan pengujian yang relevan, perbaiki defect, lalu perbarui traceability dan RELEASE_EVIDENCE.md dengan bukti aktual. Siapkan branch/PR dan runbook. Jangan merge main atau deploy produksi tanpa instruksi release. Jelaskan batas yang masih blocked tanpa menutupinya dengan hasil build.
```

## Lanjutkan setelah sesi terputus

```text
Baca STATUS.md, git diff/log dan handoff v3. Identifikasi WP terakhir, test yang benar-benar lulus, perubahan belum committed dan blocker. Lanjutkan langkah berikutnya tanpa mengulang pekerjaan selesai kecuali ada perubahan yang memerlukan test ulang. Jangan menganggap ringkasan sesi sebagai bukti live integration.
```


## Kerjakan histori riset pada WP05 lalu verifikasi melalui WP09

Baca kontrak histori riset dan uji R01–R05. Gunakan dua run sintetis. Buktikan bahwa ringkasan per run menampilkan inventaris serta jumlah yang benar-benar diperiksa, dan bahwa impor ulang tidak mengubah progres pribadi. Hubungkan ringkasan ke Inbox. Perlihatkan hasil sebelum/sesudah dan catat apakah bukti berasal dari mock, database uji, atau live owner. Untuk agregat historis di luar kontrak tool Hermes, arahkan owner ke halaman riwayat.
