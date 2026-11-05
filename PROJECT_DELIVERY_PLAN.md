# Rencana Delivery dan Delegasi Proyek

Baseline 3.2 | 5 November 2026 | Product owner Gerard Viriyandra

## Tujuan dan hasil akhir

Membangun tracker pribadi tiga kategori dengan database sebagai sumber kebenaran, integrasi Calendar/Sheets yang dapat dipulihkan, serta akses percakapan melalui Hermes dan Telegram. Keberhasilan diukur dari alur nyata dan bukti pengujian, bukan jumlah halaman UI atau persentase coding.

Paket ini adalah arahan PM untuk pelaksana Codex. Peran engineer/QA di bawah adalah tanggung jawab pekerjaan, bukan klaim bahwa sudah ada tim manusia atau beberapa agent yang menjalankannya. Codex boleh bekerja berurutan; kerja paralel baru dipilih jika owner menghendaki dan dependensinya aman.

## Tanggung jawab

| Aktivitas | Penanggung jawab pelaksanaan | Keputusan akhir | Bukti |
|---|---|---|---|
| Scope, prioritas, pilihan provider/budget | Owner | Owner | Decision log |
| Audit repo dan desain teknis | Codex engineer | Owner untuk perubahan scope; engineer untuk detail rutin | ADR dan file map |
| UI, domain, migrations, API | Codex engineer | Owner melalui UAT | Commit, test, demo |
| Google dan agent adapter | Codex integration role | Owner memberikan akun/config lokal | Contract test dan live smoke |
| Test dan review keamanan akses | Codex QA/reviewer role | Owner menerima release | Evidence per test |
| Isi secrets, jalankan Ollama, buat bot | Owner dengan runbook | Owner | Status setup tanpa nilai secret |
| Publikasi produksi dan cutover | Codex menyiapkan; owner mengeksekusi/menyetujui sesuai konteks | Owner | Release evidence dan rollback plan |

## Urutan paket kerja

| Gelombang | Paket | Hasil yang dapat diperiksa | Ketergantungan |
|---|---|---|---|
| 0 | WP00 | Audit source, branch, risk dan ADR | Dokumen tersedia |
| 1 | WP01–WP02 | Login owner, DB, capture, list/detail, tujuh menu | WP00 |
| 2 | WP03–WP05 | Agenda, Google, Sheets, migrasi dan recovery | Domain/auth siap |
| 3 | WP06–WP08 | Token scope, empat tool MCP, Telegram Windows | WP01–WP02; deadline butuh WP03 |
| 4 | WP09–WP10 | UAT, test ulang, release evidence, setup aktual | Seluruh capability terkait |

Paket agent dapat diuji menggunakan data sintetis setelah domain siap tanpa menunggu live Google. Mock tidak meluluskan live gate. Ketika server model lokal belum berjalan, lakukan seluruh unit/integration adapter test dan tandai percakapan live BLOCKED.

## Release gates

| Gate | Kriteria keluar | Penghalang yang sah |
|---|---|---|
| G0 Audit | Repo/instruksi/branch/baseline benar, ADR disimpan, pekerjaan pengguna aman | Repo tidak dapat diakses |
| G1 Core | Auth, migrations, CRUD, draft, transaksi, navigasi, UI tests lulus | Konfigurasi DB uji belum ada |
| G2 Integrasi data | Google mock + live owner, Sheets reconciliation, legacy Calendar dan restore dibuktikan | Kredensial/provider/config eksternal |
| G3 Agent code | Empat tool, auth scopes, receipt, retry, cross-channel dedup lulus | Domain API belum siap |
| G4 Telegram pilot | Windows setup, model lokal lolos H19, private owner, live Q&A + capture + revoke lulus | Provider/bot/laptop belum dikonfigurasi |
| G5 Penerimaan | FR01–FR56 traced; INT01–24 dan H01–24 passed atau gate belum dirilis; tidak ada P0 fail | Evidence tidak cukup |

Rilis website inti boleh diberi label G1/G2 sesuai bukti. Rilis terintegrasi memerlukan seluruh G0–G5. Tidak ada label full production ready jika hanya build dan mock yang lulus. Sistem lokal belum memenuhi ketersediaan 24/7, termasuk backup scheduler yang berhenti saat laptop mati.

## Aturan perencanaan dan estimasi

Gunakan status NOT_STARTED, IN_PROGRESS, IMPLEMENTED_UNVERIFIED, TESTED_MOCK, TESTED_LIVE, BLOCKED, ACCEPTED. Status dokumen terpisah dari status kode. Setiap blocked mencatat dependency, penanggung jawab, pekerjaan yang tetap dapat lanjut dan langkah membuka blokir.

Estimasi kalender belum ditetapkan karena repo kosong, kapasitas sesi Codex, kinerja hardware dan hosting belum final. Gunakan ukuran relatif S/M/L pada backlog untuk mengurutkan risiko, bukan mengubahnya menjadi jam otomatis. Setelah WP00, Codex mengusulkan estimasi rentang berdasarkan jumlah slice dan hasil smoke awal; owner memutuskan jadwal target.

## Definition of Ready

Paket tugas memiliki FR/INT/H terkait, dependency tersedia atau mock boundary jelas, contoh input/output, path perubahan, risiko migrasi dan bukti selesai yang dapat diuji. Credential bukan syarat memulai implementasi adapter; diperlukan untuk live gate.

## Definition of Done

Implementasi memenuhi acceptance; pengujian bermakna lulus; error/degraded states ada; data pribadi dan secrets tidak masuk commit; dokumentasi aktual cocok dengan perintah yang tersedia; STATUS.md diperbarui dengan command dan hasil. Jika live masih blocked, paket belum ACCEPTED walau kode dapat direview.

## Pelaporan dan handoff antarsesi

Setiap akhir sesi Codex: sebutkan WP aktif, perubahan perilaku, file/commit, test yang dijalankan, hasil aktual, blocker dan langkah berikutnya. Gunakan templates/STATUS.md. Simpan checkpoint Git yang wajar sebelum perubahan berisiko; tidak force push atau merge otomatis. Jangan menghitung completion percentage dari jumlah checkbox dokumen.

Perubahan produk baru dicatat sebagai change request: kebutuhan, scope sekarang, delta, dampak data/security/tests, pilihan rollback dan keputusan owner. Contoh perlu keputusan: menyalakan write progres Hermes, menjadikan bot multi-user, menambah riset web/cron, beralih server berbayar atau memberi Hermes coding tools. Perbaikan bug dan pilihan implementasi rutin tidak membutuhkan siklus persetujuan baru.


## Bukti tambahan untuk serah terima 3.1

WP05 dan WP09 membawa fixture dua run sampai ke Inbox serta mencatat hasil R01–R04 di G2. WP08 menunjukkan satu pertanyaan status yang ambigu dan satu pertanyaan agregat historis melalui Telegram di G4 (R05). Owner menerima hasil setelah memeriksa pemisahan delapan pemeriksaan sumber dari 20 record inventaris. Release dihentikan bila replay membuat perubahan ganda atau riwayat pribadi tertimpa.
