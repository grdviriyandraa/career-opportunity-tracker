# Project Instructions

Template untuk digabungkan ke AGENTS.md repo setelah memeriksa instruksi existing; jangan overwrite.

- Gunakan PRD v3 dan kontrak tersanitasi yang tersedia pada workspace. Jangan mengaku membaca file yang tidak ada.
- Pertahankan pekerjaan pengguna. Satu lockfile, migrations terkontrol, synthetic fixtures saja.
- Website dan agent API menggunakan service domain yang sama. DB adalah sumber kebenaran.
- Agent hanya membaca peluang/deadline dan membuat draft. Jangan menambah coding runtime, Google direct write, arbitrary SQL/HTTP atau shell dari Telegram.
- Lindungi unknown, personal fields, revision, provenance dan stable identity. Transaksi meliputi audit/outbox.
- Jalankan test relevan dan tulis hasil aktual. Mock tidak membuktikan live provider.
- Jangan commit .env, credential/session Hermes, data tracker, CV atau handoff privat. Tinjau staged diff sebelum commit.
- Catat scope change sebagai ADR/change request. Detail teknis rutin diselesaikan mandiri.
- Jangan merge main, force push, destructive migration atau deploy produksi tanpa instruksi yang sesuai.
