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

Layanan memuat maksimal 1.000 milestone owner menurut ID sebelum memfilter rentang. Ketika batas tercapai, hasil ditandai tidak lengkap; paging seluruh sumber belum tersedia. Setiap kategori menampilkan maksimal 100 pasangan peringatan. Overflow dan baris invalid menyebabkan hasil parsial. Jumlah yang ditampilkan bukan total seluruh pasangan jika terpotong.

Kalender pribadi selalu berstatus belum terhubung pada implementasi website ini. Engine murni memiliki kontrak cache sintetis untuk menguji cakupan, umur maksimal 15 menit, kalender gagal/parsial, timestamp invalid, deduplikasi busy dan pengecualian kalender aplikasi sendiri. Cakupan cache harus mencakup margin buffer. Kontrak tersebut belum terhubung ke Google OAuth/FreeBusy atau penyimpanan cache live; unit tests bukan bukti integrasi provider.

Recurrence, exceptions, pembatalan, workload mingguan, pengingat, edit kapasitas dan Google Calendar masih belum tersedia. Agenda ini merupakan subset WP03, bukan penerimaan seluruh PRD.

## Bukti

15 unit tests Agenda mencakup interval, batas 48 jam hingga nanodetik, date-only, conditional, buffer, rentang, DST New York/Sydney, 60-record fixture, source/alert caps dan cache degraded. Dua browser scenarios desktop/390px memeriksa API owner, validasi query, fixture milestone nyata pada PostgreSQL/PGlite, klasifikasi bentrok/deadline, buffer, cakupan dan overflow layout. Semua data sintetis. Lihat RELEASE_EVIDENCE.md serta evidence/agenda-coverage-desktop.png dan evidence/agenda-coverage-mobile.png.
