# Riwayat riset dan impor manual

Implementasi WP05 tahap pertama: normalized research JSON → preview tersimpan di server → owner review → transaksi apply → snapshot immutable. Ini belum menjadi koneksi Google Sheets, parser DAILY_RESEARCH_LOG, initial migration, emergency patch, scheduler, atau backup/restore.

## Menyiapkan database

Jalankan kedua migrasi dalam urutan nama file melalui Supabase SQL editor/admin migration connection:

1. `supabase/migrations/20261105143738_core.sql` (jika belum pernah diterapkan).
2. `supabase/migrations/20261105143833_research.sql`.

Versi file kini cocok dengan history hosted yang dibuat MCP pada setup awal. Keduanya sudah diterapkan pada project development existing; jangan jalankan ulang. File sebelumnya bernama `202611050001_core.sql` dan `202611050002_research.sql`; isi SQL tidak berubah. Periksa migration history serta checksum sebelum menyiapkan database lain.

Jangan menjalankan kembali migrasi yang sudah diterapkan. Database uji dibuat fresh dan kedua migrasi sudah dieksekusi pada PostgreSQL/PGlite. Konfigurasi hosted serta pengiriman email masih perlu diuji dengan project owner.

## Memasukkan satu run

Di Inbox, buka **Impor snapshot riset (JSON)**, pilih file atau tempel JSON, lalu **Buat preview impor**. Periksa inventaris, jumlah baru/lama diperiksa/hasil lama. **Terapkan impor yang ditinjau** memakai payload dan hash yang telah disimpan server, bukan payload pengganti dari browser.

- Maksimum 512 KiB dan 1.000 item pemeriksaan per batch. Bukan batas historis 251 baris. Run berikutnya bisa membawa delta, sementara inventaris sebelumnya diambil dari ledger sumber yang sama.
- `source_system` memisahkan inventaris setiap sumber. Angka ini bukan jumlah seluruh peluang pada website.
- `action=new`: identitas sumber baru. `enriched`: identitas yang sudah ada dalam ledger sumber. Untuk identitas existing yang belum dimigrasikan, sistem menolak dan memerlukan initial migration; tidak menebak mapping berdasarkan judul/baris.
- Array `items` hanya memuat item yang benar-benar diperiksa. Item lain dibawa ke snapshot sebagai `carry_forward` dengan `checked_at=null` dan timestamp pemeriksaan terakhir dipertahankan.
- `inventory_total` dan lima klasifikasi harus cocok dengan proyeksi ledger setelah delta. High Priority terpisah dan dapat null. Cakupan/batasan yang tidak dilaporkan tetap null.
- Run ID dan payload identik: no-op. Urutan item tidak memengaruhi hash. Run ID sama/payload berbeda: koreksi disimpan untuk review, snapshot awal tidak diganti. UI memperlihatkan koreksi; penerapan versi koreksi belum tersedia.
- Preview berlaku 15 menit. Perubahan domain atau impor lain setelah preview menolak apply dengan 409. Buat preview baru dan tinjau ulang.
- Impor bertanggal lebih lama dari run terakhir sumber yang sama ditolak; first-seen existing tidak dapat diganti diam-diam. First-seen tidak boleh melampaui hari run dalam zona sumber.

## Format v1

Contoh berikut **sintetis untuk memahami format, bukan seed produksi**:

```json
{
  "schema_version": 1,
  "source_system": "example_research",
  "run_id": "EXAMPLE-001",
  "source_as_of": "2026-11-05T08:04:00+07:00",
  "source_timezone": "Asia/Jakarta",
  "inventory_total": 1,
  "reported_new": 1,
  "reported_enriched": 0,
  "high_priority_active": null,
  "snapshot": {
    "confirmed": 0,
    "conditional": 0,
    "pending": 1,
    "ineligible": 0,
    "closed": 0
  },
  "coverage": null,
  "limitations": null,
  "items": [
    {
      "external_id": "EXAMPLE-JOB-001",
      "action": "new",
      "category": "job",
      "title": "Synthetic analyst",
      "organization": "Example Organization",
      "classification": "pending",
      "source_url": "https://example.org/jobs?id=1",
      "source_checked_at": "2026-11-05T08:04:00+07:00",
      "first_seen_at": null,
      "published_at": null,
      "official_deadline": null,
      "raw_posting_status": "unverified"
    }
  ]
}
```

`category` boleh null. `title`/`organization` dapat tidak dilaporkan. Tanggal publikasi/deadline yang tidak diketahui tetap null/absent; sistem tidak mengubahnya menjadi tanggal hari ini, 23.59, milestone, atau tindakan melamar. URL hanya disimpan, tidak di-fetch. Canonical URL menjaga query identitas lowongan; tracking yang dikenal dibuang untuk dedup.

Schema strict berlaku pada root dan setiap item. `notes`, `contacts`, `personal_stage`, `actual_date`, `owner_id`, dan field lain di luar kontrak ditolak, bukan diterapkan. Payload tidak dikirim ke provider model. File handoff privat dan tracker sebenarnya tidak dijadikan fixture.

## Review perubahan publik

Impor membuat peluang baru dengan stage saved, tetapi tidak menimpa peluang existing. Fakta sumber untuk existing disimpan sebagai usulan, sementara snapshot sumber tetap dapat diaudit.

Buka detail peluang melalui item snapshot atau tautan review. Panel membandingkan **saat usulan dibuat / sekarang / usulan**. Pilih hanya field publik yang hendak diterapkan: judul, organisasi, kelayakan, atau status posting. Nilai unknown tidak dapat menghapus fakta yang sudah ada. Klik **Terapkan field terpilih** atau **Abaikan usulan ini**. Revisi usang menghasilkan 409 dan membutuhkan review ulang. Replay keputusan yang sama tidak menambah audit/outbox lagi.

Progres, catatan, tanggal tindakan, kontak, prioritas, dan milestone tidak berada dalam field allowlist. Persetujuan posting closed tidak mengubah personal stage menjadi rejected. Review ini bukan emergency patch dan bukan persetujuan otomatis menulis Calendar.

## Bukti dan batas integrasi

`tests/research.test.ts` menjalankan R01–R04 dengan `examples/research_history.synthetic.json`, termasuk dua snapshot 16/20, delapan pemeriksaan vs dua belas carry-forward, replay/koreksi, preservasi progres, first-seen, unknown dates, stale/hash/expiry preview, owner isolation, review field dan rollback. Skenario 300 item membuktikan tidak memakai cutoff 251.

`tests/e2e/research.spec.ts` memeriksa Inbox, Overview, replay, koreksi dan review per-field pada desktop/390 px menggunakan mock transport Supabase dan PostgreSQL nyata dalam WASM. Parser Sheet live, metadata/header 117 kolom, log Search batch/S1, R05 melalui Hermes, serta integrasi Google belum diuji/diimplementasikan pada tahap ini. Jangan memasukkan seluruh workbook atau ZIP handoff ke textarea; normalisasi kontrak terlebih dahulu.
