# Ekspor data owner

Di Settings, pilih **Unduh JSON pribadi**. File memuat catatan pribadi dan teks sumber; simpan di lokasi privat. Ekspor memerlukan sesi website owner yang diverifikasi server. Tidak diperlukan key tambahan atau migrasi baru.

## Isi format versi 1

Envelope JSON berisi `manifest`, `data`, dan `integrity`. `manifest.schema_version` bernilai `1`. Sembilan tabel aplikasi diekspor: `profiles`, `opportunities`, `milestones`, `change_history`, `research_runs`, `research_identities`, `research_items`, `research_proposals`, dan `research_corrections`.

UUID, relasi internal, null, tanggal tanpa jam, instant, zona waktu, revisi dan before/after history dipertahankan. Peluang arsip serta milestone dibatalkan ikut. Setiap tabel dibaca hingga halaman kosong; halaman pendek tidak dianggap akhir data. History tidak dipotong pada 300 atau 1.000 baris. Kolom dipilih eksplisit agar credential baru tidak otomatis ikut.

Organisasi dan sumber saat ini berada di field peluang/snapshot; belum ada entitas organization/source/action/document terpisah. Manifest mencatat entitas yang belum tersedia. Upload dokumen belum diimplementasikan: `files.status` adalah `not_implemented`; inventaris kosong bukan bukti audit bucket Storage. File biner tidak ditanamkan.

Auth users/sessions, credential/hash grant agent, receipt retry, outbox, preview sementara dan payload koreksi riset privat dikecualikan; metadata koreksi tetap ada. Credential yang diketik sendiri ke catatan/teks sumber tetap merupakan isi pribadi pengguna. Format ini belum dapat memulihkan seluruh database atau antrean integrasi.

## Kelengkapan dan batas

Pembacaan memakai publishable client dengan cookie owner, RLS existing dan filter owner eksplisit. Hitungan seluruh tabel diambil sebelum membaca data, lalu diperiksa ulang setelah semua tabel selesai. Owner, relasi peluang/run, duplikasi, kemajuan cursor, kelengkapan field dan jumlah baris diperiksa sebelum file dikirim. Error database, count drift, relasi hilang atau batas terlampaui membatalkan unduhan; tidak ada file parsial atau file ekspor yang disimpan server.

Pembacaan **bertahap, bukan snapshot transaksi atomik**. Edit bersamaan yang mempertahankan jumlah baris masih mungkin tidak terdeteksi. Hindari perubahan selama ekspor. Manifest menyimpan batas ini, waktu mulai/selesai dan status count verification. Checksum memeriksa integritas file, bukan konsistensi snapshot database atau keaslian penulis.

Batas: 500 baris per permintaan, 50.000 per tabel, 300 permintaan halaman, 16 MiB JSON akhir, deadline pembacaan database 60 detik. Tabel ber-ID memakai keyset UUID. `research_identities` memakai offset terurut pada `(source_system, external_id)` menurut collation database, sehingga teks impor tidak disisipkan ke ekspresi filter PostgREST.

`POST /api/export` memerlukan Origin canonical aplikasi dan cookie owner. GET, bearer agent, header identitas, tanpa sesi dan origin lain tidak menyediakan ekspor. Respons sukses/error memakai `Cache-Control: private, no-store`; sukses berupa attachment JSON dengan `nosniff`. Settings menyediakan loading, pencegahan klik ganda dan error/retry.

## Checksum dan pemulihan

SHA-256 setiap array tabel ada di `manifest.tables[table].sha256`, bersama jumlah baris. `integrity.payload_sha256` mencakup `{ manifest, data }`, tanpa `integrity`. Encoding `sorted-keys-json-utf8`: urutkan key object secara rekursif dengan `.sort()` JavaScript, pertahankan urutan array, serialize JSON tanpa whitespace, hash byte UTF-8.

Contoh verifikasi offline, tanpa mengunggah data atau mengakses jaringan:

```sh
node --input-type=module - /path/pribadi/export.json <<'JS'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const v = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const canonical = x => x === null || typeof x !== 'object' ? JSON.stringify(x)
  : Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']'
  : '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
const hash = x => createHash('sha256').update(canonical(x), 'utf8').digest('hex');
if (v.manifest.schema_version !== 1 || v.integrity.algorithm !== 'SHA-256' ||
    v.integrity.encoding !== 'sorted-keys-json-utf8' ||
    hash({ manifest: v.manifest, data: v.data }) !== v.integrity.payload_sha256)
  throw new Error('Versi atau checksum tidak cocok');
for (const [table, info] of Object.entries(v.manifest.tables))
  if (v.data[table].length !== info.row_count || hash(v.data[table]) !== info.sha256)
    throw new Error('Checksum/jumlah tabel tidak cocok');
console.log('Checksum dan jumlah tabel cocok; ini bukan bukti restore.');
JS
```

Restore/import file ini belum tersedia (`manifest.restore_supported: false`). Backup terjadwal, inventaris dokumen nyata, isolated restore drill dan ekspor penuh FR38 tetap pekerjaan berikutnya. Pengujian memakai data/transport sintetis dengan SQL PostgreSQL PGlite nyata; belum membuktikan sesi owner hosted.
