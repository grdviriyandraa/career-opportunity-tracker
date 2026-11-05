# Keputusan Asumsi Risiko dan Pertanyaan Terbuka

Versi 3.2 | 5 November 2026. Status confirmed berarti jawaban pengguna; proposed berarti keputusan desain yang dapat disesuaikan dengan bukti; open berarti belum dipilih.

## Decision log

| ID | Keputusan | Status dan asal | Dampak |
|---|---|---|---|
| D01 | Hermes di laptop dahulu | Confirmed, jawaban hosting | Tidak ada SLA 24/7 |
| D02 | Windows tanpa WSL | Confirmed, jawaban OS | Panduan native; WSL opsional |
| D03 | Baca tracker dan simpan draft | Confirmed, jawaban bot scope | Tidak ada write progres/jadwal |
| D04 | Codex membangun aplikasi | Confirmed, jawaban peran Codex | Tidak ada coding agent runtime dari Telegram |
| D05 | Bot belum dibuat | Confirmed | Setup dari BotFather |
| D06 | Inferensi lokal dan biaya API Rp0 | Confirmed | Ollama adalah usulan runtime; tag akhir mengikuti hasil uji |
| D07 | Database tracker sumber utama | Baseline sebelumnya dipertahankan | Hermes memory bukan master |
| D08 | Google Calendar wajib MVP | Baseline sebelumnya dipertahankan | Live Google gate tetap wajib |
| D09 | Next.js + Supabase default | Baseline rekomendasi teknis | Bisa berubah dengan ADR yang memenuhi scope |
| D10 | Local stdio MCP bridge | Proposed technical default | Tidak membutuhkan tunnel inbound |
| D11 | Bot khusus private owner | Proposed sesuai aplikasi pribadi | Allowlist dan uji private-only |
| D12 | Notifikasi proaktif Telegram P1 | Proposed batas pilot | Ringkasan on-demand tersedia; Calendar tetap pengingat |
| D13 | Empat tools dan grant 30 hari | Proposed technical default | Scope minimal, revoke dapat diuji |
| D14 | Tidak ada riset web baru melalui Hermes pada pilot | Proposed batas rilis | Riset existing tetap berjalan terpisah |

## Hal yang masih perlu diputuskan

| ID | Pertanyaan | Owner | Gate | Jalan lanjut sementara |
|---|---|---|---|---|
| Q01 | Model lokal mana yang lolos pada laptop | Gerard | G4 | Bangun bridge dengan mock provider |
| Q02 | Biaya API model Hermes | Gerard | Diputuskan | Rp0, semua fallback cloud nonaktif |
| Q03 | Hosting website dan DB produksi apa | Gerard + Codex rekomendasi | G2/G5 production | Local development; Supabase default desain |
| Q04 | Akun Google dan kalender mana yang dipilih | Gerard | Google live | Mock adapter dan setup states |
| Q05 | Owner auth identity dan project DB | Gerard melalui setup lokal | G1 real DB/live | Synthetic DB/auth test |
| Q06 | Nama bot dan numeric user ID | Gerard melalui wizard lokal | G4 | Placeholder config; tidak meminta token di chat |
| Q07 | Apakah Apps Script legacy aktif | Gerard + inspeksi saat cutover | G2 | Tahan penulis Calendar baru sampai jelas |

Tidak ada pertanyaan yang menghalangi penulisan spesifikasi dan pembangunan source tanpa secret. Q02 sudah diputuskan. Q01 dijawab dengan mengukur memori, latensi dan keberhasilan tool call pada laptop. Akses login/secrets diselesaikan di lingkungan pengguna.

## Risk register

| Risiko | Peluang / dampak | Trigger | Mitigasi dan pemilik |
|---|---|---|---|
| Laptop sleep menghentikan bot | Tinggi / sedang | Bot tidak menjawab | Label pilot lokal, fallback website, owner menjalankan gateway |
| Status dijawab dari memori lama | Sedang / tinggi | Tidak ada tool receipt | Grounding policy + eval; Codex QA |
| Dua gateway memakai token sama | Sedang / sedang | Konflik polling atau respons ganda | Single receiver dan inventory proses; owner |
| Dua writer Calendar/riset | Sedang / tinggi | Event/batch ganda | Scheduler registry dan cutover legacy; integration role |
| Retry capture duplicate | Sedang / tinggi | Timeout sesudah commit | Durable intent + unique identity + concurrency test; backend |
| Capability Hermes terlalu luas | Sedang / tinggi | Shell/Google/DB tool muncul | Profile minim, tool discovery audit, server scope; integration role |
| Profil memanggil model eksternal | Sedang / tinggi | Rute utama/bantu keluar dari loopback | Hentikan pilot, koreksi profil dan ulang H19; owner |
| Paket privat ter-commit | Sedang / tinggi | Sheet ID/notes ada di diff | Folder privat, sanitasi, staged diff review; Codex |
| Format config berubah | Sedang / sedang | Upgrade Hermes gagal discovery | Pin versi, backup config, smoke ulang; owner |
| Restore menghidupkan token yang dicabut | Rendah / tinggi | Grant lama kembali | Revoke seluruh grant setelah restore sebelum networking; backend |
| AI mengikuti instruksi di sumber | Sedang / tinggi | Tool call di luar intent | Minim data mentah, backend authorization, injection tests; QA |
| Offline chat hilang | Sedang / sedang | Link saat laptop mati | Jangan janjikan antrean tahan lama; gunakan website; owner |

## Change request template

ID; kebutuhan pengguna; baseline yang berubah; solusi; dampak data/API/permission/biaya; acceptance tambahan; migrasi dan rollback; keputusan; tanggal; bukti. Catat keputusan di sini dan perbarui PRD/kontrak/backlog secara bersamaan agar Codex tidak mendapat instruksi bertentangan.
