# Runbook Operasi dan Pemulihan

Versi 3.2 | Target pilot Windows | Belum menjadi bukti deployment.

## Start dan stop harian

1. Periksa backend: jika lokal, jalankan sesuai README aplikasi dan pastikan DB aktif. Jika hosted, periksa login serta health yang tidak mengekspos data.
2. Pastikan credential agent belum expired/revoked dan file token berada di lokasi yang ditetapkan. Jangan tampilkan nilainya saat diagnosis.
3. Pastikan Ollama aktif melalui http://127.0.0.1:11434/v1/models dan tag lokal tersedia. Jalankan satu `hermes gateway` pada PowerShell. Jika sudah ada service gateway aktif, jangan menyalakan proses foreground kedua.
4. Uji pertanyaan umum lalu baca satu record sintetis/pilihan owner. Response menyebut data_as_of dan detail link.
5. Hentikan foreground dengan Ctrl+C. Website hosted tetap aktif; website lokal memerlukan proses sendiri. Sleep/logout/mati dapat memutus bot.

Notifikasi deadline tidak diserahkan ke bot laptop. Latensi, konsumsi memori, biaya API Rp0 dan hasil smoke dicatat owner selama pilot 14 hari, tanpa mengklaim uptime penuh.

## Diagnosis dan penanganan

| Kondisi | Tindakan | Verifikasi pulih |
|---|---|---|
| Bot tidak menjawab | Periksa proses, internet, token validity dan allowlist | Chat umum sukses |
| Bot bisa chat tetapi tidak baca tracker | Periksa bridge discovery, path Node, API base, grant expiry | Satu read dengan request ID |
| 401/403 dari API | Revoke/mint ulang bila perlu; cek scope, jangan bypass | Grant baru hanya tiga scope |
| Backend 5xx/timeout | Hentikan retry agresif, gunakan correlation ID | Read sehat; pending capture direkonsiliasi |
| Capture timeout | Periksa intent ledger/receipt; replay key sama | Satu opportunity ID dan satu domain change |
| Tool tidak diizinkan muncul | Matikan gateway/profile, audit effective tools | Tepat empat MCP tools dan minimum built-ins |
| Dugaan token bocor | Revoke grant tracker; revoke bot/provider credential yang terdampak | Token lama ditolak, data tetap ada |
| Google gagal | Buka health Google website, reconnect sesuai capability | Live smoke pada Calendar khusus |
| Reminder/event ganda | Hentikan writer yang diduga duplikat; inventaris mapping | Satu owner per event dan scheduler |

## Rotasi credential

Token tracker: revoke lama melalui website, mint baru dengan scope sama dan expiry, ganti file lokal, restart bridge/gateway, uji read dan capture sintetis, pastikan lama 401. Token Telegram: gunakan alur rotasi BotFather bila diperlukan dan update wizard lokal; jangan menghapus database tracker. Profil pilot memakai endpoint model lokal tanpa kredensial provider cloud. Setiap credential memiliki dampak terpisah.

## Upgrade Hermes atau bridge

Catat versi yang berjalan, backup config dan state lokal privat, hentikan gateway, upgrade satu komponen pada satu waktu, periksa perubahan schema/config, jalankan discovery empat tool lalu H01/H03/H07/H08/H15/H16/H20. Perubahan tool default setelah upgrade harus diaudit. Jika gagal, kembalikan distribusi/versi dan config sebelumnya memakai prosedur resmi; jangan menghapus data home untuk memperbaiki launcher.

## Backup dan restore

Backup DB, object storage dan manifest sesuai kontrak Google/Sheets baseline. Snapshot export bukan backup DB. Ledger adapter yang menyimpan pending capture harus dipertahankan dengan akses privat; tidak masuk repo. Konfigurasi dan credential Hermes disimpan terpisah, tanpa mengekspor secrets ke paket handoff.

Restore ke lingkungan terisolasi dengan integration writes disabled. Sebelum mengizinkan traffic agent pada DB hasil restore, revoke semua integration grants hasil restore dan terbitkan ulang hanya yang diperlukan. Ini mencegah token yang sudah dicabut hidup kembali. Rekonsiliasi pending intents terhadap ID/receipt hasil restore sebelum replay; jangan menjalankan replay otomatis jika snapshot kehilangan transaksi setelah backup. Verifikasi relasi/count/hash, kemudian Google mapping dan outbox sebelum mengaktifkan worker.

## Rollback release

1. Hentikan capture agent dan worker eksternal yang terpengaruh; website dapat tetap read-only jika dibutuhkan.
2. Catat last good commit, schema version, timestamp snapshot dan delta setelah snapshot.
3. Rollback kode hanya jika schema kompatibel. Untuk destructive migration, pilih forward fix atau restore terencana; jangan menjalankan down migration tanpa menilai kehilangan data.
4. Pertahankan audit/idempotency receipts. Rekonsiliasi data baru sebelum membuka write.
5. Uji core capture, scope deny, grant revoke dan satu Google sync yang sah. Catat keputusan owner serta hasil.

## Pindah dari laptop ke server pada tahap berikutnya

Ini P1, belum perintah membeli server. Pilih hosting/budget, siapkan credential baru, pindahkan konfigurasi secara privat, hentikan gateway laptop, pastikan tidak ada polling kedua, lalu aktifkan instance server dan ulangi gate. Jangan menyalin session rahasia ke repo. Ubah label ketersediaan hanya setelah monitoring membuktikan operasi server.
