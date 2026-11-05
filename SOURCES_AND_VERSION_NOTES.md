# Sumber dan Catatan Versi

Dokumentasi baru diperiksa 5 November 2026. Sumber mendukung kemampuan produk; schema, scope sempit, limit, task breakdown dan release gates merupakan keputusan proyek. Tidak ada perintah yang dijalankan pada laptop pengguna.

| ID | Sumber primer | Dipakai untuk |
|---|---|---|
| H1 | https://hermes-agent.nousresearch.com/docs/getting-started/installation | Installer native dan distribusi |
| H2 | https://hermes-agent.nousresearch.com/docs/user-guide/windows-native | Path Windows, dukungan native, opsi autostart |
| H3 | https://hermes-agent.nousresearch.com/docs/getting-started/quickstart | Setup model dan chat awal |
| H4 | https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram | Bot setup, allowed users, gateway, pending updates |
| H5 | https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp | Local stdio, konfigurasi dan tool filter |
| H6 | https://hermes-agent.nousresearch.com/docs/user-guide/features/tools | Pengaturan toolsets per platform |
| H7 | https://hermes-agent.nousresearch.com/docs/user-guide/configuration | Config edit dan pemisahan secret |
| T1 | https://core.telegram.org/bots/api#getting-updates | Retensi update dan polling/webhook |
| T2 | https://core.telegram.org/bots/features#botfather | BotFather dan pengaturan bot |
| O1 | https://learn.chatgpt.com/docs/codex/cli | Instalasi dan login Codex CLI |
| G1 | https://api.github.com/repos/grdviriyandraa/career-opportunity-tracker/contents | Audit mengembalikan This repository is empty |

Referensi Google/Sheets/Next.js/Supabase baseline dipertahankan dari pemeriksaan 4 November dalam PRD dan INTEGRATION_CONTRACTS.md; bukan audit ulang live 5 November. Installer dan CLI dapat berubah: verifikasi --help, versi serta dokumentasi pada saat setup. Tidak ada nomor versi dependency atau harga provider yang ditebak.

Nama path tools/tracker-mcp, endpoint /api/agent/*, menu Settings > Hermes, build:mcp dan variabel TRACKER_* adalah kontrak proyek yang harus dibangun Codex. Jangan menganggapnya fitur Hermes bawaan. Diagram adalah target arsitektur. Reference source tetap snapshot historis parsial, tidak runnable.

## Dasar keputusan inferensi lokal pada versi 3.2

Pengguna memilih model di laptop dan anggaran API Rp0. Ollama dan qwen3.5:4b merupakan usulan untuk uji hardware. Langkah, sumber resmi serta uji kegagalan ada di bagian 3 SETUP_HERMES_TELEGRAM_CODEX.md.
