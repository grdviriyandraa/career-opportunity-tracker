# Agenda internal: aturan dan batas

Agenda membaca milestone owner dan timezone profile melalui sesi Supabase yang diverifikasi serta RLS. `GET /api/agenda` memakai `Cache-Control: private, no-store`. Tidak ada perubahan schema, mutation atau panggilan Google dari pemeriksaan ini.

Form dan API menerima `start` (tanggal ISO; default hari ini pada zona profile), `days` (1–180, default 180), `buffer_before` dan `buffer_after` (0–120 menit, default 0). API menolak parameter tak dikenal atau berulang. Form berlaku untuk pemeriksaan saat ini, tidak menyimpan konfigurasi atau mengubah milestone.

## Semantik

- Rentang tampilan dan acara memakai batas setengah terbuka: awal termasuk, akhir tidak termasuk. Acara yang selesai tepat saat acara berikutnya mulai tidak bentrok ketika buffer nol.
- Buffer memperluas kedua acara, sebelum dan sesudah sesuai pilihan. Ini toleransi jadwal, bukan perhitungan rute perjalanan.
- Dua acara berjam dengan kehadiran confirmed dan durasi beririsan menghasilkan bentrok pasti. Kehadiran conditional/unknown atau presisi tanggal menghasilkan potensi bentrok. Irisan hanya pada buffer menghasilkan peringatan buffer.
- Tanggal saja tetap memiliki start_at/end_at null. Batas hari pada zona sumber hanya digunakan untuk menghitung kemungkinan; bukan komitmen penuh satu hari. Hari DST dapat 23 atau 25 jam.
- Deadline tidak menjadi busy interval atau durasi kerja. Dua deadline dengan jarak maksimal 48 jam mendapat peringatan terpisah. Presisi tanggal menghasilkan peringatan potensi karena jam tidak diketahui.
- Interval lintas tengah malam dan acara mulai sebelum rentang tetapi masih beririsan tetap diperiksa. Instant membandingkan offset sebenarnya, termasuk pada jam berulang saat DST.

## Cakupan yang ditampilkan

Kartu cakupan menunjukkan awal/akhir eksklusif, zona profile, waktu pemeriksaan, jumlah dimuat dan dalam rentang, serta kondisi data internal. Tidak ada peringatan bukan bukti seluruh jadwal bebas bentrok.

Layanan membaca milestone owner bertahap menurut ID yang stabil, maksimal 500 per request, sebelum memfilter rentang. Halaman pendek tidak dianggap akhir karena provider bisa membatasi jumlah baris. Pembacaan berhenti setelah halaman kosong, maksimal 10.000 milestone atau 100 request halaman. Probe satu baris membedakan tepat 10.000 baris dari ekor yang terpotong. Batas yang tercapai menyebabkan hasil tidak lengkap. Setiap kategori menampilkan maksimal 100 pasangan peringatan. Overflow dan baris invalid menyebabkan hasil parsial. Jumlah yang ditampilkan bukan total seluruh pasangan jika terpotong.

API menambahkan `source_read`: jumlah halaman, batas baris, total awal/akhir, apakah akhir sumber sudah ditemukan, kelengkapan dan alasan degradasi. Exact count pada awal serta pembacaan HEAD pada akhir memakai sesi owner/RLS yang sama. Count hilang, count berubah, count tidak cocok atau cursor tidak maju membuat hasil tidak lengkap. Error provider membatalkan respons sukses; hasil separuh jalan tidak disajikan sebagai pemeriksaan berhasil.

Pembacaan ini berurutan (`source_read.mode=sequential`), bukan snapshot transaksi tunggal. Kesamaan jumlah awal/akhir tidak menjamin tidak ada perubahan isi atau penggantian baris bersamaan; muat ulang setelah mengubah jadwal. Konsistensi snapshot lintas halaman belum tersedia.

Validasi zona dan batas hari tanggal sama di-cache hanya selama satu pemeriksaan, dengan key zona + tanggal. Tidak ada cache data user lintas request. Ini mengurangi kerja Intl/Temporal berulang pada inventaris besar, sambil mempertahankan semantik DST, invalid date dan sumber berbeda zona. Pengukuran fixture 5.000 tanggal identik bukan bukti latency hosted/P95.

Kalender pribadi selalu berstatus belum terhubung pada implementasi website ini. Engine murni memiliki kontrak cache sintetis untuk menguji cakupan, umur maksimal 15 menit, kalender gagal/parsial, timestamp invalid, deduplikasi busy dan pengecualian kalender aplikasi sendiri. Cakupan cache harus mencakup margin buffer. Kontrak tersebut belum terhubung ke Google OAuth/FreeBusy atau penyimpanan cache live; unit tests bukan bukti integrasi provider.

Edit, batal dan pulih milestone kini tersedia melalui detail peluang pada source lokal. Record dibatalkan tetap tersimpan tetapi tidak dihitung sebagai jadwal aktif, termasuk pada count/pagination dan deadline agent. Lihat [lifecycle milestone dan migrasi yang diperlukan](MILESTONES.md). Recurrence, exceptions, workload mingguan, pengingat, edit kapasitas dan Google Calendar masih belum tersedia. Agenda ini merupakan subset WP03, bukan penerimaan seluruh PRD.

## Bukti

26 unit tests Agenda/source mencakup interval, batas 48 jam hingga nanodetik, date-only, conditional, buffer, rentang, DST New York/Sydney, source zones berbeda, 60-record fixture, source/alert caps dan cache degraded. Empat browser scenarios desktop/390px memeriksa API owner, validasi query, fixture milestone pada PostgreSQL/PGlite, klasifikasi bentrok/deadline, buffer, cakupan dan overflow layout. Fixture 5.000 milestone membuktikan bentrok pada dua baris terakhir terdeteksi melalui API dan UI. Tests juga memeriksa clamp provider, batas 10.000 tepat vs lebih, count berubah/hilang, cursor tidak maju dan kegagalan di tengah pembacaan. Lifecycle menambahkan 14 uji unit/database dan dua scenario browser edit/batal/pulih. Semua data sintetis; bukti aktual terbaru ada di RELEASE_EVIDENCE.md.
