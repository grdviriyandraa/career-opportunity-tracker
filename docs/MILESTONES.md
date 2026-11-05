# Lifecycle milestone internal

Edit, batal dan pulih tersedia di detail peluang. Migrasi `20261105165019_milestone_lifecycle.sql` sudah diterapkan hosted setelah persetujuan owner; checksum, schema/ACL dan penolakan akses anonymous terverifikasi. Sesi owner hosted dan website deployment belum diuji. Ini tidak menambah recurrence atau mengubah Google Calendar.

## Perilaku owner

Milestone aktif memiliki panel **Edit milestone**. Form mengirim judul, jenis, presisi, tanggal/waktu, zona dan partisipasi. Date-only tetap tanpa jam; instant memerlukan ISO dengan offset eksplisit. Mengganti presisi mengosongkan field tanggal/waktu yang tidak relevan, tanpa default midnight atau konversi wall time browser.

**Batalkan milestone** menyimpan cancelled_at yang ditentukan server. ID dan jadwal tetap ada; detail menampilkan status dibatalkan. Milestone itu dikecualikan dari Agenda, hitungan/pagination aktif dan deadline agent. **Pulihkan milestone** mengaktifkan ID/jadwal yang sama. Pulihkan sebelum mengedit jadwal yang dibatalkan. Tidak ada hard delete atau pembatalan satu instance recurrence.

Stage, notes, actual_date dan status posting peluang tidak berubah. Parent revision dan milestone revision harus cocok; konflik memerlukan muat ulang/tinjau sebelum mengulang. Tidak ada force-save. Penyimpanan nilai sama atau state batal/aktif yang sudah sama dengan revisi terbaru adalah no-op tanpa perubahan revision/history/outbox tambahan.

## API dan transaksi

`PATCH /api/opportunities/{opportunityId}/milestones/{milestoneId}` memerlukan sesi owner dan Origin canonical. Bearer agent, anonymous, ID salah dan field owner/personal tak dikenal ditolak. Tidak ada tool MCP untuk mengedit/membatalkan/memulihkan; token agent hanya membaca deadline aktif.

Body edit memakai schema milestone existing ditambah expected_milestone_revision; seluruh field jadwal relevan wajib disertakan. Body cancel/restore adalah object strict:

```json
{
  "expected_revision": 3,
  "expected_milestone_revision": 1,
  "cancelled": true
}
```

expected_revision adalah revisi peluang. Keduanya integer positif. Jangan mencampur cancelled dengan field edit, atau mengirim owner/actor/cancelled_at/revision baru. Sparse edit tidak didukung agar pergantian presisi tidak meninggalkan field lama yang tidak relevan.

RPC public.update_milestone memberi EXECUTE hanya kepada authenticated, memakai owner guard dan search_path kosong. Lock berurutan: parent opportunity lalu milestone; owner dan hubungan kedua ID juga diperiksa. SQL memvalidasi tanggal kalender, offset, zona dan interval. Perubahan nyata menaikkan kedua revision, menyimpan before/after pada change_history, serta menambah outbox dalam satu transaksi. Audit memakai milestone_updated, milestone_cancelled, milestone_restored. Kegagalan audit/outbox membatalkan seluruh perubahan.

Pembatalan menambah calendar_cleanup_review; edit/pulih menambah milestone_changed. Outbox tetap blocked karena worker provider belum tersedia. Tidak ada event Google yang diterbitkan/dihapus dan tidak ada provider yang dihubungi oleh fitur ini.

## Pembacaan dan penerapan

cancelled_at nullable/default null menjaga record existing tetap aktif. Partial index owner_id/id mencakup milestone aktif. Agenda menerapkan cancelled_at IS NULL pada setiap page/count dan HEAD count akhir; engine murni juga mengabaikan canceled input. Agent read mempertahankan guard/ACL existing dan mengecualikan deadline canceled. Detail membaca aktif maupun canceled agar status/restore tersedia. Pagination masih sequential; ubah jadwal lalu periksa ulang bila dibutuhkan.

Keempat migrasi core/research/agent/lifecycle sudah tercatat pada project development existing; jangan diterapkan ulang. Source filename mengikuti versi history MCP tanpa mengubah SQL atau menulis ulang metadata history. Database lain memerlukan pemeriksaan target/history tersendiri. Advisors masih memuat warning SECURITY DEFINER yang didokumentasikan pada release evidence; ini bukan bukti seluruh acceptance hosted selesai.

## Validasi

14 tests baru mencakup edit/no-op, kedua revision guard, cancel/restore, transaction rollback, role/ID isolation, invalid date/zone/offset/interval, injection dan eksklusi deadline agent. Dua scenario browser desktop/390px memeriksa alur UI, stale write, channel protection, active counts, history dan preservasi progres personal. PGlite dan Auth/PostgREST sintetis tidak membuktikan OTP/JWT hosted, Google sync atau concurrency multi-connection hosted.

Regresi inventaris 5.000 milestone juga memverifikasi pembacaan aktif tetap lengkap. Batas hari dan validasi zona di-cache per pemeriksaan untuk menghindari konversi tanggal identik berulang; uji tambahan menjaga tanggal yang sama di source zones berbeda tidak tercampur.
