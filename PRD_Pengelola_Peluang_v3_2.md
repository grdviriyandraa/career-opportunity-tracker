# PRD Pengelola Peluang Karier dan Kompetisi

Versi 3.2 | 5 November 2026 | Pemilik produk Gerard Viriyandra

Dokumen ini menetapkan kebutuhan website pribadi untuk mengelola pekerjaan, bootcamp, kompetisi, dan jadwal terkait. Website menjadi sumber data utama setelah migrasi. Google Calendar digunakan sejak MVP untuk pemeriksaan kesibukan dan penayangan agenda. Google Sheets menjadi jalur riset sementara, keluaran ekspor, dan sarana koreksi darurat yang harus direkonsiliasi sebelum diterapkan.

## Perubahan versi dan baseline implementasi

Versi 3 menambahkan Hermes dan Telegram sebagai kanal percakapan serta capture draft. Baseline v2 tentang Next.js, Google, migrasi dan pemulihan dipertahankan. Keputusan baru, batas akses bot dan tahapan penerimaan dicatat eksplisit. Keputusan satu pengguna, website sebagai sumber utama, Sheets sebagai jalur riset dan pemulihan, serta Google Calendar sejak MVP tetap berlaku. Dokumen ini menetapkan target implementasi; keberadaan kode awal tidak berarti fitur telah lolos uji penerimaan.

Repository target adalah https://github.com/grdviriyandraa/career-opportunity-tracker. Pada audit 4 November 2026 repository berstatus public dan kosong. Pemeriksaan Contents API pada 5 November 2026 masih mengembalikan This repository is empty. Bukti build/source berikut adalah audit historis 4 November, bukan pengujian ulang pada versi ini. Source lokal parsial telah ditemukan: model, form, API, schema D1 dan adapter Google, tetapi halaman utama masih placeholder. TypeScript dan build Vinext lulus; belum ada bukti live OAuth, E2E, migrasi produksi atau restore. Snapshot kode terpilih tersedia dalam paket handoff sebagai referensi; bukan aplikasi Next.js standar siap deploy.

| Aspek | Keadaan yang terverifikasi | Tindak lanjut |
|---|---|---|
| Tracker | Google Sheets dengan 12 tab, 84 header Jobs Bootcamps dan 33 header Competitions | Migrasi berbasis header dan ID; jangan mengarang mapping |
| Riset per 5 November 08.04 WIB | 20 peluang; 0 confirmed, 3 conditional, 2 pending, 7 ineligible, 8 closed/expired | Empat baru dan empat lama diperiksa; 12 memakai bukti sebelumnya. Lihat RESEARCH_RUN_RECORD.md. |
| Automation | Enabled, harian 08.00 WIB mulai 5 November 2026 | Tetap menulis Sheets selama transisi; website mengimpor secara terkontrol |
| Kode lokal | Vinext, Cloudflare D1 dan bucket, auth gateway ChatGPT | Port konsep yang layak ke Next.js standar; adapter deployment dan auth harus diganti |
| Integrasi Google | Kode parsial tersedia | Kredensial dan live verification belum dibuktikan; status setup harus jujur |
| Calendar legacy | CareerCalendarSync.gs tersedia, menulis primary dan menyimpan iCalUID | Status trigger belum diverifikasi; rekonsiliasi sebelum mengaktifkan penulis baru |

PRD ini dilengkapi IMPLEMENTATION_HANDOFF.md, INTEGRATION_CONTRACTS.md, SHEETS_FIELD_MAPPING.csv, dan PROMPT_CODEX.md. Kontrak integrasi memperinci desain teknis, sedangkan kebutuhan dan acceptance criteria produk tetap ditetapkan dalam PRD. Bila source referensi berbeda, spesifikasi versi 3 menjadi acuan.

## Riwayat riset dalam produk

Pada 4 November pukul 18.28 WIB, tracker berisi 16 peluang. Run berikutnya pada 5 November pukul 08.04 WIB menambah empat dan memeriksa ulang empat peluang lama. Delapan catatan memiliki pemeriksaan sumber pada run kedua. Seluruh 20 masuk hitungan kelayakan; belum ada yang terverifikasi memenuhi semua kriteria atau mendapat prioritas tinggi.

Pada Inbox, pemilik dapat membuka ringkasan per run, waktu pemeriksaan, jumlah peluang baru, jumlah lama yang diperiksa serta total inventaris setelah run. Tampilkan tanggal publikasi, pertama ditemukan dan verifikasi terakhir secara terpisah pada detail. Contohnya, Avomind baru masuk tracker pada 5 November dengan skor sementara 78 dan status penerimaan belum pasti. Tenggat belum terverifikasi tetap kosong di Agenda.

Saat pengguna bertanya melalui Telegram tentang peluang tertentu, Hermes membaca record beserta waktu verifikasi dan tahap pribadi dari API. Jika angka historis seluruh run tidak tersedia melalui empat tool pilot, arahkan pengguna ke riwayat Inbox. Jadwal riset, pembaruan status pribadi dan pembuatan agenda tetap mengikuti pemilik proses masing-masing. Uji R01–R05 merinci penerimaan FR05, FR21, FR22, FR27, FR45 dan FR51.

## Ringkasan keputusan produk

| Area | Keputusan | Implikasi |
|---|---|---|
| Pengguna | Satu pengguna pribadi | Akses dibatasi ke akun pemilik; kolaborasi bukan cakupan MVP |
| Pengelolaan harian | Website serta Telegram melalui Hermes | Website untuk pengelolaan lengkap; bot untuk tanya informasi dan capture draft |
| Sumber data utama | Database website | Sheets dan Calendar tidak menimpa progres secara otomatis |
| Google Calendar | Wajib dalam MVP | Kalender terpilih diperiksa; agenda aplikasi ditulis ke kalender khusus |
| Google Sheets | Ekspor dan jalur riset sementara | Impor memakai ID stabil dan aturan kepemilikan field |
| Koreksi darurat | Sheets boleh dipakai saat ada masalah | Perubahan dipratinjau, diperiksa konflik, dan dicatat sebelum masuk website |
| Pengisian awal | Link atau teks menjadi jalur utama | Ekstraksi menghasilkan draf yang dapat dikoreksi |
| Pelaksanaan pendaftaran | Pengguna melakukan tindakan aktual | Klik link tidak berarti sudah melamar, membayar, atau terdaftar |

## Masalah dan hasil yang dituju

Peluang ditemukan melalui portal pekerjaan, situs penyelenggara, media sosial, dan kontak pribadi. Informasinya tidak seragam dan dapat berubah. Mengisi seluruh atribut saat pertama menyimpan memperlambat pencatatan. Tenggat pengumpulan juga berbeda dari acara yang mengharuskan kehadiran, sehingga kalender yang hanya berisi deadline belum cukup untuk mencegah bentrok.

Produk harus memungkinkan pengguna menyimpan peluang dengan cepat, melengkapi data sesuai tahap, melihat tindakan berikutnya, dan mempertimbangkan jadwal sebelum berkomitmen. Informasi yang belum diketahui tetap terlihat sebagai ketidakpastian. Data hasil riset dipisahkan dari keputusan dan progres pribadi.

Profil awal adalah mahasiswa aktif Sistem Informasi Universitas Airlangga angkatan 2024. Preferensi pekerjaan mencakup business analysis, data, consulting, market research, product analytics, dan AI atau machine learning. Ketersediaan pekerjaan maksimal 20 jam per minggu. Lokasi utama Surabaya; pekerjaan di luar Surabaya harus memenuhi persyaratan remote yang sesuai. Tahun kelulusan, IPK, dan status final year tidak diasumsikan.

## Cakupan dan prioritas

P0 berarti wajib sebelum peluncuran MVP. P1 berarti pengembangan berikutnya. P2 berarti pilihan jangka lebih panjang. Prioritas ini adalah keputusan perencanaan, bukan estimasi durasi implementasi.

| Prioritas | Kemampuan | Batas cakupan |
|---|---|---|
| P0 | Akun pribadi dan profil | Satu akun pemilik, preferensi, zona waktu, kapasitas |
| P0 | Jobs Bootcamps Competitions | Form bertahap, daftar, detail, filter, status, histori |
| P0 | Simpan dari link dan teks | Ekstraksi draf, koreksi, sumber, fallback manual |
| P0 | Inbox riset | Impor terkontrol dari Sheets dan deduplikasi |
| P0 | Tahapan dan tindakan | Jadwal dinamis, tugas, dokumen rujukan, tanggal aktual |
| P0 | Agenda dan bentrok | Kalender internal, Google Calendar, pengingat |
| P0 | Migrasi dan pemulihan | ID stabil, ekspor, koreksi darurat, backup terpisah |
| P0 | Hermes dan Telegram | Chat umum, baca tracker, capture draft; laptop Windows |
| P1 | Aksi dan notifikasi Telegram | Update progres/jadwal serta pengingat proaktif setelah scope terpisah |
| P1 | Poster dan PDF | OCR serta ekstraksi jadwal dengan pemeriksaan |
| P1 | Penemuan langsung dari website | Adapter riset menggantikan perantara Sheets |
| P1 | Analitik dan scoring lanjutan | Perbandingan peluang dan penilaian otomatis lebih lengkap |
| P2 | Penerimaan share dan ekstensi | PWA atau browser extension sesuai dukungan perangkat |
| P2 | Kolaborasi tim | Akun lain, pembagian tugas, dan berbagi data |

MVP tidak mencakup auto apply, pengiriman pesan recruiter, pembayaran, pembacaan seluruh email, akses WhatsApp, atau pendaftaran atas nama pengguna. Nama anggota tim boleh dicatat sebagai informasi; mereka tidak memperoleh akun atau akses bersama.

## Struktur navigasi dan layar

| Menu | Tampilan utama | Tindakan utama |
|---|---|---|
| Overview | Tugas hari ini, deadline, proses aktif, bentrok | Buka tindakan yang perlu diselesaikan |
| Inbox | Temuan baru dan perubahan sumber | Tinjau, simpan, gabungkan, abaikan |
| Jobs | Tersimpan, siap dilamar, proses, selesai | Tambah peluang, tandai melamar, tambah tahapan |
| Bootcamps | Dipertimbangkan, mendaftar, mengikuti, selesai | Catat batch, biaya, sesi, dan progres |
| Competitions | Dipertimbangkan, terdaftar, berjalan, selesai | Catat tim, deliverables, tahapan, hasil |
| Agenda | Kalender gabungan dan daftar peringatan | Periksa bentrok, ubah jadwal, refresh |
| Settings | Profil, Google, akses Hermes, ekspor, pemulihan | Atur preferensi dan periksa kesehatan integrasi |

Jenis pekerjaan, bidang, lokasi, arrangement, biaya, dan prioritas menjadi filter. Kategori utama satu per peluang; draft Telegram yang belum jelas kategorinya boleh unclassified sampai ditinjau di Inbox. Tag boleh lebih dari satu. Perubahan kategori mempertahankan identitas, sumber, dan histori. Data khusus kategori lama tidak dibuang tanpa pratinjau.

Layar detail menggunakan bagian Ringkasan, Progres, Jadwal, Dokumen dan Kontak, serta Riwayat. Tampilan awal memprioritaskan status, tindakan berikutnya, deadline terdekat, informasi kritis yang belum diketahui, dan konflik. Atribut riset yang panjang tersedia dalam bagian yang dapat dibuka.

## Alur pengguna

### Menyimpan peluang

1. Pengguna membuka Tambah peluang dari kategori aktif atau Inbox.
2. Pengguna menempel link atau teks. Nama manual tersedia jika sumber tidak dapat dibuka.
3. Sistem menyimpan draf segera, lalu menjalankan ekstraksi jika diaktifkan.
4. Sistem menampilkan hasil, sumber, dan bagian yang tidak ditemukan.
5. Pengguna mengoreksi data penting dan menyimpan. Informasi yang belum diketahui tidak menghalangi penyimpanan draf.

Kategori mengikuti menu asal dan dapat diubah. Ekstraksi tidak boleh memaksa pengisian semua field. Status kualitas data membedakan Draf, Ditinjau pengguna, dan Perlu verifikasi. Ditinjau pengguna tidak otomatis berarti sumber atau perusahaan telah terverifikasi.

### Mencatat tindakan aktual

Pengguna memilih Tandai sudah melamar, Tandai sudah mendaftar, atau Tandai sudah submit. Sistem mengusulkan tanggal sekarang dengan pilihan tanggal lampau dan bukti opsional. Tindakan dapat dibatalkan dengan histori. Membuka link atau menyimpan peluang tidak mengubah tanggal tindakan aktual.

### Menambah jadwal

Pengguna memilih jenis tahapan, tanggal, kepastian, dan kebutuhan kehadiran. Jam serta akhir kegiatan hanya diwajibkan untuk interval waktu pasti. Sistem memeriksa agenda internal dan kesibukan kalender terpilih. Pengguna dapat tetap menyimpan jadwal yang bentrok setelah membaca peringatan; aplikasi tidak membatalkan peluang secara otomatis.

### Menangani perubahan riset

Inbox menampilkan field lama, usulan baru, sumber, dan waktu pemeriksaan. Perubahan pada deadline, lokasi, jam kerja, atau persyaratan yang sudah dikonfirmasi pengguna memerlukan peninjauan. Penerapan perubahan jadwal memicu pemeriksaan bentrok dan pembaruan agenda terkait.

## Aturan kelengkapan dan input

| Tahap | Minimum yang dibutuhkan | Data yang boleh menyusul |
|---|---|---|
| Simpan draf | Sumber link, teks, atau nama sementara | Organisasi, persyaratan, jadwal, biaya |
| Evaluasi peluang | Nama dan organisasi; kendala penting ditampilkan | Informasi yang tidak diumumkan tetap unknown |
| Siap dilamar | Nama posisi dan perusahaan; gap kelayakan terlihat | Kontak atau kompensasi boleh belum diumumkan |
| Komitmen hadir | Tanggal atau rentang, tingkat kepastian, kehadiran | Jam yang belum diumumkan menghasilkan potensi bentrok |
| Pendaftaran aktual | Jenis tindakan, tanggal aktual | Bukti dan catatan tambahan opsional |

Input dibedakan menjadi otomatis, hasil ekstraksi, dan konfirmasi pengguna. Pengguna dapat mengoreksi seluruh hasil ekstraksi. Field yang dikoreksi menyimpan nilai sebelumnya serta asal perubahan. Unknown, nol, dan tidak berlaku adalah nilai yang berbeda.

### Data bersama

| Field | Bentuk dan aturan | Asal utama |
|---|---|---|
| Opportunity ID | ID internal tetap; legacy ID dipertahankan | Sistem |
| Kategori dan tag | Job, bootcamp, competition; tag multi nilai | Menu asal dan pengguna |
| Nama dan organisasi | Nama tampilan serta relasi organisasi | Ekstraksi dan pengguna |
| Sources | Beberapa URL/teks dengan kanal dan waktu | Impor atau capture |
| Link tindakan | Link melamar, mendaftar, atau submit; terpisah dari sumber | Ekstraksi dan pengguna |
| Prioritas | Tinggi, sedang, rendah; default sedang | Pengguna |
| Tahap proses | Enum khusus kategori; boleh melompat tahap | Pengguna |
| Tindakan berikutnya | Kata kerja, tanggal opsional, selesai/belum | Pengguna dan saran sistem |
| Milestones | Daftar tahapan tanpa batas kolom tetap | Ekstraksi dan pengguna |
| Kontak dan dokumen | Nama/kanal/link; unggah bukti opsional | Pengguna |
| Catatan dan hasil | Catatan pribadi serta hasil aktual | Pengguna |
| Biaya atau kompensasi | Status, angka/rentang, mata uang, satuan | Ekstraksi dan pengguna |
| Waktu pencatatan | Created, first seen, checked, updated | Sistem; tidak saling menggantikan |
| Provenance | Sumber, pemeriksaan, aktor, revisi per perubahan penting | Sistem |
| Arsip | Arsip reversibel; histori tidak dihapus | Pengguna atau rekomendasi |

### Data Jobs

| Field | Aturan |
|---|---|
| Perusahaan dan posisi | Dipisahkan; satu perusahaan dapat memiliki banyak posisi |
| Role family | BA, data analyst, data scientist, business/IT consulting, strategy consulting, market research, BI, product/growth, AI/ML, lainnya |
| Employment type | Internship, part-time, freelance/project, contract, full-time, unknown |
| Work arrangement | Onsite, hybrid, remote, unknown |
| Lokasi kerja | Kota/negara; terpisah dari kantor pusat perusahaan |
| Remote eligibility | Indonesia diizinkan, tidak diizinkan, unknown; sertakan bukti |
| Jam kerja | Jam employer dan ketersediaan pengguna disimpan terpisah |
| Durasi dan mulai | Tanggal/rentang atau teks syarat; unknown diperbolehkan |
| Student eligibility | Aktif, final year, graduate, aturan lain; tidak disimpulkan dari judul |
| Persyaratan | Jurusan, pengalaman, bahasa, work rights, keterampilan |
| Kompensasi | Paid, unpaid, unknown; nominal dan satuan terpisah |
| Deadline | Published, confirmed contact, atau unknown; tanggal sumber agregator diberi label |
| Tanggal melamar | Tindakan aktual pengguna; dapat dibedakan per putaran aplikasi |
| Rekrutmen | Assessment dan beberapa wawancara, offer, keputusan, follow-up |

Status proses yang tersedia adalah Tersimpan, Menyiapkan, Melamar, Assessment, Wawancara, Offer, Diterima, Ditolak, Ditarik, dan Selesai. Status lowongan adalah Terbuka, Bersyarat, Ditutup, Kedaluwarsa, Tidak dapat diakses, atau Unknown. Penutupan lowongan tidak otomatis mengubah lamaran pengguna menjadi Ditolak.

Kelayakan pekerjaan memakai Confirmed eligible, Conditional, Ineligible, dan Pending verification. Kesesuaian dengan batas 20 jam, lokasi, persyaratan mahasiswa, dan kredibilitas diperiksa sebelum rekomendasi. Sales, lead generation, dan pekerjaan berbayar untuk melamar dikecualikan sesuai preferensi awal. Skor riset lama dapat ditampilkan dengan asal dan waktu pemeriksaan. Scoring baru lanjutan bukan penghalang peluncuran MVP; prioritas pengguna tetap terpisah dari skor riset.

### Data Competitions

| Field | Aturan |
|---|---|
| Nama, penyelenggara, edisi | Edisi/tahun membedakan kompetisi yang berulang |
| Jenis dan bidang | Case, esai, data science, business plan, hackathon, lainnya |
| Partisipasi | Individu/tim; ukuran tim dan peran muncul secara kondisional |
| Tim | Nama tim, anggota sebagai teks, PIC; tanpa akses kolaborasi MVP |
| Eligibility | Status mahasiswa, jurusan, usia, institusi, batas anggota |
| Biaya | Gratis, berbayar, unknown; per orang/per tim; early bird dan regular dapat dicatat |
| Pembayaran | Belum bayar/dibayar/tidak berlaku; bukti opsional; tidak mengeksekusi pembayaran |
| Deliverables | Paper, deck, video, kode, proposal; versi/link dan status |
| Tahapan | Registrasi, submission, TM, mentoring, semifinal, final, pengumuman, custom |
| Pelaksanaan | Lokasi dan arrangement per tahapan, termasuk rentang beberapa hari |
| Hasil dan manfaat | Lolos/tidak lolos/hasil lain; hadiah atau benefit sesuai sumber |

Status kompetisi tersedia sebagai Dipertimbangkan, Terdaftar, Mengerjakan, Submitted, Semifinal, Final, Selesai, Tidak lolos, dan Ditarik. Perpindahan tidak dipaksa linear. Kalender final bersyarat tetap dapat dilihat, tetapi belum dianggap komitmen pasti. Tidak lolos menonaktifkan komitmen tahap berikutnya tanpa menghapus histori.

### Data Bootcamps

| Field | Aturan |
|---|---|
| Nama, penyelenggara, batch | Batch berbeda menjadi peluang berbeda |
| Topik dan level | Bidang, tingkat, serta prasyarat |
| Format | Live, self-paced, campuran; online/onsite/hybrid terpisah |
| Periode | Mulai dan selesai; unknown atau rolling diperbolehkan |
| Sesi | Jadwal berulang dan pengecualian per tanggal |
| Beban | Jam kelas dan jam tugas per minggu, sebagai estimasi terpisah |
| Biaya | Harga, diskon/beasiswa, satuan, mata uang, biaya tambahan |
| Seleksi | Deadline, tanggal daftar, assessment, hasil |
| Penyelesaian | Kehadiran, proyek akhir, syarat sertifikat sesuai sumber |
| Progres | Dipertimbangkan, Mendaftar, Diterima, Terdaftar, Mengikuti, Selesai, Ditarik |

Kelas self-paced tidak menghasilkan sesi sibuk otomatis. Pengguna dapat membuat blok belajar sendiri. Beasiswa yang belum diputuskan tidak mengubah harga menjadi gratis.

## Agenda dan aturan bentrok

Milestone minimal menyimpan jenis, hubungan peluang, tanggal atau rentang, presisi waktu, zona waktu asal, kepastian informasi, komitmen kehadiran, lokasi, dan status. Zona waktu tampilan awal Asia/Jakarta. Waktu asing disimpan dengan zona IANA agar perubahan daylight saving diperhitungkan. Deadline tanpa jam tidak otomatis dianggap pukul 23.59. Representasi date dan dateTime mengikuti perbedaan pada Google Calendar [2].

| Jenis | Definisi | Respons produk |
|---|---|---|
| Bentrok pasti | Dua interval pasti dengan kehadiran terkonfirmasi beririsan | Peringatan kuat dengan kedua acara |
| Potensi bentrok | Tanggal beririsan tetapi jam atau partisipasi masih tentatif | Label potensi; tampilkan data yang kurang |
| Tenggat menumpuk | Beberapa batas pengumpulan dalam jendela 48 jam | Peringatan persiapan; ambang dapat diatur |
| Perjalanan | Jarak antaracara tidak memenuhi buffer yang dipilih | Peringatan berdasarkan buffer, bukan estimasi rute otomatis |
| Beban berlebih | Total estimasi mingguan melampaui kapasitas | Tampilkan penjumlahan dan komponen yang belum diketahui |
| Tidak dapat dipastikan | Kalender gagal/stale atau durasi belum tersedia | Jangan tampilkan jadwal aman sebagai kepastian |

Untuk dua interval, bentrok terjadi jika awal A lebih kecil dari akhir B dan awal B lebih kecil dari akhir A. Acara yang berakhir tepat saat acara lain mulai tidak bertabrakan tanpa buffer. Buffer awal nol; pengguna dapat mengatur sebelum/sesudah dan menyesuaikan per acara. Deteksi sesi berulang memperhitungkan pengecualian dan pembatalan.

Deadline pengumpulan menjadi penanda waktu yang tidak memblokir satu hari penuh. Acara berjam pasti dan kehadiran terkonfirmasi memblokir waktunya. Kegiatan tanggal saja, termasuk final, menghasilkan potensi bentrok sampai jam ditentukan. Status tentative dan pengaturan busy/free ditetapkan eksplisit; keduanya bukan atribut yang sama [2].

Kapasitas pekerjaan awal maksimal 20 jam per minggu. Kapasitas gabungan pekerjaan, lomba, dan bootcamp belum ditentukan pengguna dan tidak diberi angka otomatis. Beban pekerjaan mingguan tidak dijumlahkan lagi dari blok kalender yang merepresentasikan pekerjaan yang sama. Jam dengan estimasi tidak lengkap ditampilkan sebagai minimum yang diketahui beserta komponen unknown.

Jendela bentrok awal adalah 180 hari ke depan dan dapat diperpanjang. UI selalu menyebutkan periode yang diperiksa. Jadwal di luar periode tidak boleh diberi label sudah bebas bentrok.

## Integrasi Google Calendar

### Kewenangan dan pemilihan kalender

Pengguna memilih kalender yang akan diperiksa. MVP membaca interval sibuk, bukan isi detail agenda pribadi, kecuali perluasan akses disetujui kemudian. FreeBusy menyediakan rentang busy dan dapat mengembalikan error per kalender; sistem harus mempertahankan status pemeriksaan parsial [3].

Aplikasi membuat kalender sekunder khusus, misalnya Peluang Gerard, milik akun pengguna. Hanya agenda yang dikelola aplikasi ditulis di sana. Kalender pribadi lain tidak diubah. Cakupan akses harus dipilih seminimal mungkin: akses daftar kalender read-only untuk pemilihan, akses availability untuk kalender yang dapat diakses, serta calendar.app.created untuk kalender yang dibuat aplikasi. Kombinasi akhir harus dibuktikan pada uji integrasi; scope luas calendar tidak menjadi default [1].

Autentikasi website dan koneksi Google adalah dua keadaan terpisah. Gagal menghubungkan Calendar tidak menghapus data aplikasi. Koneksi yang dipakai ChatGPT saat ini tidak diwariskan ke website. Refresh token untuk pekerjaan latar belakang disimpan di server secara terenkripsi, tidak di frontend, log, atau ekspor. OAuth offline access dan state ditangani sesuai panduan Google [5].

### Publikasi dan perubahan agenda

Pada pengaturan awal, pengguna menentukan jenis agenda yang boleh dipublikasikan. Default usulan adalah deadline yang telah ditinjau, interview/sesi terkonfirmasi, dan final yang terkonfirmasi diikuti. Agenda tentatif hanya dipublikasikan jika pengguna memilihnya. Kalender dibuat dengan akses privat; ekspor tidak menyertakan catatan HR, nomor kontak, atau dokumen pribadi ke deskripsi acara secara default.

Setiap agenda menyimpan milestone ID, Calendar ID, event ID, revisi lokal terakhir tersinkron, serta versi remote. Mengulang sync tidak menghasilkan acara baru. Kalender aplikasi dikecualikan dari pemeriksaan FreeBusy eksternal agar acara tidak bentrok dengan salinannya sendiri; agenda aplikasi dihitung dari database.

Jika pengguna mengubah acara langsung di Calendar, aplikasi menampilkan perbedaan. Pilihan adalah Terapkan ke website, Pulihkan dari website, atau Putus tautan. Perubahan luar tidak diam-diam menjadi data utama. Penghapusan remote tidak memicu pembuatan ulang tanpa keputusan. Jika kedua sisi berubah, sinkronisasi acara tersebut ditahan sampai konflik diselesaikan.

### Kesegaran dan kegagalan

Menyimpan jadwal atau menekan Periksa bentrok meminta kesibukan terbaru jika tersedia. Cache lebih dari 15 menit diberi label stale. Refresh agenda dan rekonsiliasi kalender aplikasi ditargetkan berjalan setiap 15 menit ketika layanan aktif, dengan jadwal fleksibel terhadap kuota. Pembaruan dari website ke kalender ditargetkan selesai dalam 60 detik pada kondisi integrasi sehat.

UI membedakan Pending, Synced, Failed, Needs reconnect, dan Conflict, disertai waktu sync terakhir serta tombol retry. Kegagalan Calendar tidak membatalkan penyimpanan lokal. Retry memakai backoff dan ID tetap. Ketika syncToken tidak valid, hanya cache salinan Calendar yang dibangun ulang; database peluang, milestone, dan progres pribadi tidak boleh dihapus [4].

## Pengingat dan tindakan berikutnya

Pengingat awal berupa daftar tindakan dalam website dan reminder Google Calendar untuk agenda yang dipublikasikan. Jadwal usulan adalah H minus 7, H minus 3, H minus 1, serta 1 jam sebelumnya untuk acara berjam pasti; pengguna dapat mengubahnya. Reminders harus mengikuti dukungan jenis acara dan pengaturan akun, serta diverifikasi pada integrasi [2]. Tidak ada janji notifikasi email, WhatsApp, atau push browser pada MVP.

Satu milestone yang direvisi mempertahankan identitas pengingat. Retry tidak membuat notifikasi ganda. Menandai tugas selesai tidak menghapus milestone historis. Jika reminder gagal disiapkan, status pengingat ditampilkan terpisah dari status penyimpanan dan sync acara.

## Riset Sheets dan kepemilikan data

Selama transisi, riset terjadwal yang sudah ada boleh tetap menulis ke Sheets. Website membaca batch riset melalui backend dengan format yang disepakati. Pengguna hanya melakukan pemeliharaan normal dari website setelah cutover. Ekspor data utama dan masukan riset ditempatkan pada bagian/tab yang terpisah agar siklus impor ekspor tidak menciptakan duplikasi.

| Kelompok field | Pemilik kebenaran | Aturan pembaruan |
|---|---|---|
| Progres, tanggal aktual, prioritas pribadi | Website | Masukan riset tidak boleh menimpa |
| Catatan, kontak pribadi, bukti | Website | Tidak diekspor ke feed riset publik |
| Judul, syarat, kompensasi, status publik | Sumber riset dengan provenance | Perubahan penting masuk review jika telah dikonfirmasi pengguna |
| Milestone yang diterima pengguna | Website | Sumber baru mengajukan perubahan, bukan overwrite |
| Busy interval kalender pribadi | Google Calendar | Dibaca dan dicache; bukan peluang baru |
| Acara kalender aplikasi | Milestone website | Sinkron keluar; perubahan remote memerlukan rekonsiliasi |
| Koreksi darurat dari Sheets | Usulan patch | Preview, validasi versi, keputusan pengguna, histori |

Pencocokan memakai canonical URL resmi, requisition ID, lalu kombinasi organisasi, judul, lokasi, jenis, dan batch/edisi. Kemiripan judul saja tidak cukup. Sumber berbeda disimpan sebagai referensi pada satu catatan. Lowongan repost tidak otomatis dianggap baru jika requisition sama.

Feed riset menyimpan external ID, run ID, timestamp, sumber, dan versi. Menjalankan batch yang sama dua kali tidak menambah catatan atau histori perubahan palsu. Record yang gagal divalidasi dikarantina dengan alasan. Kegagalan satu record tidak boleh disembunyikan sebagai keberhasilan seluruh batch. API Sheets memiliki kuota sehingga integrasi perlu batching, retry, dan status yang terlihat [6].

## Ekspor dan pemulihan darurat

Ekspor lengkap mencakup opportunities, organizations, sources, milestones, actions, history, serta manifest versi. XLSX/Sheets menyediakan tampilan manusia; JSON menyediakan struktur lengkap yang dapat dipulihkan. File dan token tidak ditanamkan dalam ekspor; dokumen memakai referensi serta inventaris file. Perubahan format memiliki schema_version.

Ekspor Sheets yang dipakai memperbaiki masalah harus menyertakan record ID dan revision. Pengguna memperbaiki field yang diperlukan, lalu memilih Impor koreksi darurat ketika website tersedia. Sistem menampilkan nilai lama, usulan, record tidak dikenal, serta konflik jika revisi website lebih baru. Pengguna memilih field yang akan diterapkan. Record tanpa ID tidak boleh memperbarui record lama hanya berdasarkan urutan baris.

Jika website tidak tersedia, pengguna bekerja dari snapshot terakhir yang berhasil diekspor; snapshot tersebut bisa tertinggal. Ekspor terbaru tidak dijanjikan ketika backend sedang gagal. Ekspor bukan pengganti backup database. Target operasional awal yang diusulkan adalah backup harian dengan RPO maksimal 24 jam dan RTO maksimal 24 jam, bergantung infrastruktur serta hasil uji restore. Angka ini belum merupakan SLA.

## Model data konseptual

| Entitas | Peran dan relasi utama |
|---|---|
| UserProfile | Satu pemilik, preferensi, zona waktu, kapasitas |
| Organization | Perusahaan/penyelenggara bersama, bukti identitas |
| Opportunity | Kategori, organisasi, status pribadi, legacy ID, revision |
| JobDetails | Persyaratan kerja dan kompensasi; satu per Job |
| CompetitionDetails | Edisi, tim, biaya, deliverables |
| BootcampDetails | Batch, pembelajaran, beban, biaya |
| SourceEvidence | Banyak sumber per peluang; field, waktu, tingkat verifikasi |
| Milestone | Banyak tahapan per peluang; waktu dan komitmen |
| ActionItem | Tugas pengguna, tanggal, keterkaitan milestone |
| ParticipationEvent | Riwayat melamar, mendaftar, submit, hasil |
| ContactReference | Kontak opsional yang dikaitkan ke peluang/organisasi |
| DocumentReference | Link/file, versi, kategori, status dokumen |
| CalendarLink | Mapping milestone dan event remote serta status sync |
| CalendarBusyCache | Cache interval eksternal, freshness, error per kalender |
| ImportRun | Batch riset, dedup, sukses/gagal, sumber |
| ChangeHistory | Aktor, field, nilai lama/baru, sumber, waktu |
| ExportSnapshot | Versi schema, waktu, checksum, referensi snapshot |

Database relasional menjadi arah desain. Preferensi pengguna adalah Next.js dan aplikasi ringan. Default implementasi yang direkomendasikan adalah Next.js standar App Router dengan TypeScript, Supabase PostgreSQL dan Auth, SQL migrations, serta storage privat bila diperlukan. Pilihan pendukung dapat diubah melalui keputusan teknis tertulis yang tetap memenuhi kebutuhan. Hosting dan layanan ekstraksi belum diaktifkan; tidak ada klaim biaya atau kemampuan paket tertentu.

### Arsitektur dan kontrak implementasi

Website menyediakan UI dan API pada satu codebase. Database menyimpan relasi domain, revisi dan audit. Perubahan data, audit serta antrean sinkronisasi disimpan dalam satu transaksi. Worker memproses outbox secara idempotent dan dapat melanjutkan pekerjaan setelah restart. Scheduler server nyata diperlukan untuk sinkronisasi latar belakang; timer browser tidak memenuhi kebutuhan.

Login aplikasi memakai sesi terverifikasi dan pembatasan akun owner. OAuth Google adalah koneksi terpisah dengan identitas Google yang diverifikasi, state sekali pakai, offline access, token terenkripsi dan scope per kemampuan. Header identitas dari template hosting lama tidak boleh dipercaya pada deployment Next.js standar. Seluruh data, file, import dan export memerlukan otorisasi server; database menggunakan owner isolation dan RLS bila memakai Supabase.

Default integrasi Sheets membaca tracker existing melalui read-only scope. Ekspor native Sheets membuat spreadsheet terpisah dengan akses file yang dibuat aplikasi bila didukung. Scope Google berlaku sesuai batas provider; pembatasan satu workbook dan field tetap diterapkan di backend. Tidak ada perubahan tracker existing atau automation dalam pekerjaan penyusunan handoff ini.

Data format inti memisahkan UUID internal dari legacy ID; uang memakai decimal dan satuan; date-only memakai tanggal lokal; acara timed menyimpan instant serta IANA timezone. Sparse patch membedakan field absent, unknown dan explicit clear. Riwayat panjang, recurrence exceptions, mapping Calendar, import ledger, dan file inventory harus dapat dipulihkan.

### Pemetaan tracker dan cutover

Header tracker telah diperiksa: JOBS_BOOTCAMPS A sampai CF dan COMPETITIONS A sampai AG. Sheet dinamis harus dibaca ulang saat migrasi. Kolom Y Weekly Hours pada tracker lama adalah ketersediaan pengguna; AU Stated Weekly Hours adalah jam yang diminta employer. Kedua nilai tidak boleh tertukar. Recruitment Stage dan tanggal tindakan pribadi hanya dimigrasikan pada initial migration; riset selanjutnya tidak memiliki hak overwrite.

Tiga mode import adalah initial migration, research dan emergency patch. Initial migration merekonsiliasi seluruh data pribadi yang valid; research hanya memasukkan proposal informasi publik; emergency patch memakai preview tersimpan di server dan pilihan per field berbasis revisi. Raw status dan provenance dipertahankan ketika enum lama dikonversi. Baris dashboard dan formula tidak dimigrasikan sebagai peluang baru.

Automation riset existing tetap menjadi sistem terpisah yang menulis Sheets pukul 08.00 WIB. Website melakukan refresh atau polling run baru; jadwal tidak boleh menganggap riset selesai tepat beberapa menit setelah mulai. Perubahan menjadi ingestion langsung adalah P1. Koneksi Google milik ChatGPT tidak diwariskan ke website.

CalendarApp getId dari script legacy menghasilkan iCalUID yang berbeda dari REST event ID. Status pemasangan trigger lama dan event yang sudah dibuat perlu diverifikasi. Jangan menebak ID dengan menghapus suffix. Sebelum publikasi baru, pengguna merekonsiliasi event lama dan menonaktifkan penulis lama yang memang aktif. Scope FreeBusy saja tidak cukup untuk mengambil detail event legacy; akses tambahan atau pemeriksaan manual harus dipilih secara eksplisit.

### Batas data di GitHub

Repository yang diberikan pengguna berstatus public pada audit. Source dan synthetic fixtures boleh berada di GitHub. Isi tracker, kontak, CV, private notes, calendar IDs, database dumps dan kredensial tetap privat. Paket handoff yang memuat konteks pribadi tidak di-commit seluruhnya; dokumentasi repo dibuat dari versi yang telah disanitasi. Data pengguna dibaca melalui integrasi atau import berotorisasi setelah aplikasi berjalan.

## Kebutuhan fungsional dan kriteria penerimaan

### Pencatatan dan progres

- FR01 Akun pribadi. Pengunjung tanpa sesi tidak dapat membaca data. Hanya akun pemilik yang diizinkan. Logout mengakhiri akses sesi pada perangkat tersebut.
- FR02 Simpan cepat. Satu link/teks/nama sementara cukup membuat draf. Gagal ekstraksi tetap meninggalkan draf yang dapat diedit.
- FR03 Form bertahap. Pilihan tim, berbayar, hybrid, atau live hanya membuka field relevan. Unknown tetap sah di draf.
- FR04 Tindakan aktual. Klik link tidak mengisi tanggal melamar. Tombol konfirmasi menyimpan tanggal dan event histori; undo mengembalikan keadaan dengan log.
- FR05 Kelayakan dan status. Closed dari riset tidak mengubah lamaran menjadi rejected. Ineligible tidak masuk rekomendasi apply meski skor tinggi.
- FR06 Sumber dan koreksi. Hasil ekstraksi menampilkan asalnya. Koreksi pengguna terlindungi dari impor riset berikutnya.
- FR07 Deduplikasi. Dua URL portal untuk requisition yang sama dapat digabung tanpa kehilangan sumber atau tindakan aktual.
- FR08 Arsip dan pencarian. Arsip dapat dipulihkan. Filter kategori, status, lokasi, arrangement, deadline, biaya, dan prioritas dapat dikombinasikan.

### Jadwal dan integrasi

- FR09 Milestone dinamis. Kompetisi dapat menambah lebih dari satu submission dan sesi mentoring tanpa perubahan schema atau kolom UI.
- FR10 Presisi jadwal. Tanggal final tanpa jam menghasilkan potensi bentrok, bukan interval pasti atau label aman.
- FR11 Bentrok interval. Wawancara 10.00 sampai 11.00 dan kelas 10.30 sampai 12.00 memunculkan bentrok pasti jika kehadiran terkonfirmasi.
- FR12 Batas interval. Acara 10.00 sampai 11.00 dan 11.00 sampai 12.00 tidak bentrok ketika buffer nol; buffer 15 menit menghasilkan peringatan.
- FR13 Deadline. Deadline tanpa jam tidak memblokir seluruh hari dan tidak dibuat menjadi 23.59 secara otomatis.
- FR14 Calendar terpilih. Kalender yang tidak dipilih tidak dimasukkan dalam pemeriksaan. Calendar aplikasi tidak dihitung dua kali.
- FR15 Sync berulang. Tiga retry untuk milestone yang sama menghasilkan satu event aktif dengan ID mapping tetap.
- FR16 Kegagalan eksternal. Putus koneksi Google tetap memungkinkan penyimpanan jadwal; UI menunjukkan belum tersinkron dan pemeriksaan belum lengkap.
- FR17 Perubahan remote. Pemindahan atau penghapusan event di Google Calendar memunculkan review; milestone lokal tidak berubah diam-diam.
- FR18 Sesi berulang. Membatalkan satu kelas bootcamp hanya menghapus komitmen instance itu; sesi berikutnya tetap ada.
- FR19 Tahapan bersyarat. Tidak lolos semifinal menonaktifkan komitmen final, tetapi catatan jadwal sebelumnya tetap tersedia.
- FR20 Pengingat. Perubahan deadline merevisi pengingat yang terkait dan tidak menciptakan pengingat duplikat.

### Data dan pemulihan

- FR21 Impor riset. Mengulang run ID yang sama dengan data identik menghasilkan nol record baru dan nol perubahan materiil.
- FR22 Kepemilikan field. Impor dengan application stage berbeda dari database ditolak untuk field tersebut; field riset yang sah tetap dapat diproses.
- FR23 Koreksi darurat. Sheet dengan revision lama memunculkan konflik. Tidak ada overwrite sebelum pengguna memilih penyelesaiannya.
- FR24 Cutover. Jumlah dan ID record sumber direkonsiliasi. Semua tahapan, tanggal aktual, sumber, dan kontak yang dimigrasikan dapat ditelusuri.
- FR25 Restore. Snapshot diuji pada lingkungan terpisah dan menghasilkan relasi serta jumlah record yang sama, tanpa menulis event kalender selama uji.
- FR26 Unknown biaya. Null plus status unknown tidak ditampilkan sebagai gratis. Nilai nol hanya menjadi gratis jika statusnya memang gratis.

### Integrasi dan kesiapan implementasi versi 2

- FR27 Sparse update. Field yang tidak dikirim pada research payload tidak mengubah nilai lama. Unknown sumber tidak menghapus nilai yang dikonfirmasi pengguna.
- FR28 Transaksi domain. Simulasi crash sesudah save tetap meninggalkan audit dan outbox konsisten; worker dapat melanjutkan tanpa duplikasi.
- FR29 Identitas URL. Dua lowongan yang berbeda hanya pada query parameter job ID tidak digabung. Parameter tracking yang dikenal boleh dihapus.
- FR30 Owner dan sesi. Akun lain, forged owner ID, spoofed identity header, dan URL file lintas owner ditolak oleh server dan kontrol data.
- FR31 Identitas OAuth. Reconnect akun Google berbeda tidak menggabungkan token lama; scope/capability dan needs reconnect ditampilkan secara akurat.
- FR32 Antrean Calendar. Lima puluh lima milestone diproses sampai selesai melalui continuation; retry insert setelah timeout tidak membuat event ganda.
- FR33 Cleanup agenda. Mengarsip atau gagal lolos menonaktifkan komitmen masa depan yang sesuai dan memperbarui event aplikasi tanpa kehilangan histori.
- FR34 Resolusi remote. Apply remote yang valid mempertahankan mapping dan baseline sync; unlink hanya terjadi bila dipilih pengguna.
- FR35 Calendar legacy. iCalUID legacy tidak dikirim sebagai REST event ID. Publikasi ganda ditahan sampai mapping atau penanganan legacy ditinjau.
- FR36 Mapping sumber. Seluruh 117 header terpetakan atau dinyatakan sebagai raw/derived secara eksplisit. Reorder kolom dan data melewati baris 251 tetap diproses benar; Y dan AU tidak tertukar.
- FR37 Preview yang sah. Emergency apply memakai preview immutable, hash, base revision dan pilihan field; payload tampering serta revisi stale ditolak.
- FR38 Ekspor lengkap. Lebih dari 300 history entries tetap diekspor seluruhnya, beserta entitas relasional dan inventaris dokumen; restore memverifikasi relasi dan checksum.
- FR39 Scheduler nyata. UI tetap menunjukkan pekerjaan pending jika worker belum tersedia. Cadence sinkronisasi, reconcile dan backup dibuktikan pada deployment yang dipilih.
- FR40 Konfigurasi jujur. Tanpa kredensial Google, aplikasi menampilkan setup atau disconnected. Mock tests tidak mengubah status live integration menjadi berhasil.
- FR41 Kesiapan GitHub. Clean install, migration pada database uji, lint, typecheck, build dan pengujian wajib dapat diulang dari source dan lockfile; tidak ada data pribadi atau secret dalam commit.
- FR42 Capture tahan gagal. URL timeout, parsing gagal dan sumber tidak dapat dibaca tetap meninggalkan draf. Fetch private/metadata/redirect berbahaya ditolak dan total timeout berlaku hingga body selesai.

Seluruh FR01 sampai FR42 merupakan P0 pada baseline ini. Setiap FR dicatat pada matriks implemented, tested atau blocked dengan bukti. Backend parsial yang dapat dikompilasi tidak otomatis memenuhi FR. Skenario integrasi INT01 sampai INT24 pada companion contract memperinci pengujian tanpa mengganti kriteria produk.

## Kanal percakapan Hermes dan Telegram

Keputusan pengguna tanggal 5 November 2026: Hermes dijalankan di laptop Windows yang belum memakai WSL; bot Telegram belum dibuat; inferensi Hermes berjalan lokal dengan anggaran API Rp0; rilis pertama mengizinkan membaca tracker dan menyimpan draft. Codex bertugas membangun aplikasi dan adapter, bukan dipanggil Hermes untuk coding. Pilihan Windows native mengikuti dukungan resmi yang diperiksa; perintah setup harus dicocokkan dengan versi yang benar-benar terpasang.

### Pembagian pengalaman

Website mempertahankan Overview, Inbox, Jobs, Bootcamps, Competitions, Agenda dan Settings. Website dipakai untuk membandingkan peluang, review sumber, mengelola status, Calendar, ekspor dan pemulihan. Telegram menjadi akses cepat: pertanyaan umum, mencari peluang yang sudah tersimpan, menanyakan status/deadline, membaca agenda aplikasi dan mengirim sumber ke Inbox. Website tidak perlu chatbot tambahan pada rilis ini.

Hermes memahami percakapan dan memanggil tool terbatas; database tracker tetap sumber kebenaran. Model AI diperlukan untuk percakapan Hermes, tetapi website dan fungsi capture dasarnya tetap berjalan tanpa provider AI. Penelitian baru dari internet berbeda dari pencarian isi tracker. Riset baru melalui Hermes, voice, OCR, pengubahan progres/jadwal dan notifikasi proaktif Telegram masuk tahap berikutnya; jangan mengaktifkannya hanya karena Hermes mempunyai kemampuan tersebut.

| Intent pengguna | Perilaku yang diharapkan | Batas |
|---|---|---|
| Apa itu business analyst | Jawaban umum yang singkat | Tidak perlu membaca data pribadi |
| Ada internship remote 20 jam | Cari tracker; pisahkan cocok dan jam belum diketahui | Part-time tidak otomatis memenuhi 20 jam |
| Deadline minggu ini apa | Baca milestone; gunakan Asia/Jakarta | Tanggal tanpa jam tetap tanpa jam |
| Status lamaran perusahaan X | Baca personal_stage terbaru; pilih record bila ambigu | Tidak menyimpulkan applied dari percakapan lama |
| Simpan link ini | Buat draft dan berikan ID serta tautan website | Belum reviewed, belum applied, belum publikasi Calendar |
| Saya sudah apply, ubah status | Jelaskan batas rilis dan beri tautan detail | Tidak menjalankan mutation status lewat Hermes |
| Cari lowongan terbaru di internet | Jelaskan bahwa pencarian tracker dan riset baru berbeda | Arahkan ke alur riset existing; jangan mengklaim sudah mencari |

### Desain sambungan

Hermes memakai local stdio MCP bridge yang dibangun Codex. Bridge memanggil API agent tracker dengan token khusus owner dan scope sempit. API berada pada backend yang sama dengan website dan menjalankan service domain yang sama. Tidak ada SQL bebas atau service-role Supabase di Hermes. Pada pilot lokal, bridge menuju loopback backend yang berada di laptop yang sama; ketika website dihosting, bridge memakai HTTPS ke origin yang diizinkan. Port MCP publik dan tunnel tidak diperlukan untuk pilot ini.

Satu bot hanya memiliki satu penerima update: Hermes. Website tidak memasang webhook/poller Telegram kedua. Worker tracker tetap memiliki Calendar, Sheets ingestion dan backup. Automation riset existing tetap memiliki tugas riset harian selama transisi. Hubungan ini menghindari event atau riset ganda.

### Konsistensi dan pembatasan

Respons tool menyertakan ID, revision, data_as_of, provenance ringkas dan status partial/stale bila berlaku. Query tidak boleh menyatakan lowongan masih terbuka hari ini jika waktu verifikasinya lama. Link yang dikirim ke bot tidak dibuka melalui browser/shell Hermes; backend capture menyimpannya dahulu dan menjalankan fetcher terbatas bila ekstraksi diaktifkan. Dokumen sumber dan hasil tool adalah data tak terpercaya, bukan instruksi untuk memperluas akses.

Create draft memakai transaksi dan deduplikasi yang sama dengan website. Idempotency key dibuat dan dipersist oleh adapter, bukan dipercaya sebagai janji model. Exact identity menautkan ke record existing tanpa menimpa data reviewed; fuzzy candidate memerlukan review. Riwayat mencatat agent credential dan provenance Telegram bila transport dapat membuktikannya. Nama pengguna, owner_id dan chat_id dari argumen model tidak menjadi dasar otorisasi.

### Ketersediaan dan pengingat

Pilot laptop merupakan layanan saat aktif, tanpa janji 24/7. Sleep, logout, internet putus atau proses berhenti dapat menghentikan respons. Saat backend juga lokal, website lokal ikut tidak tersedia ketika laptop mati; isolasi website dari Hermes baru berlaku ketika backend dihosting terpisah. Deadline tetap ditampilkan di website dan pengingat Google Calendar mengikuti integrasi baseline. Bot tidak menjadi kanal pengingat kritis pada rilis pertama.

Telegram proaktif adalah P1: kelak membutuhkan outbox notifikasi, preferensi kanal, jam tenang, expiry dan satu penanggung jawab delivery. Rilis ini tidak menyalakan reminder atau digest Telegram baru. Pengguna dapat meminta ringkasan melalui chat saat bot aktif.

### Pengukuran penerimaan Hermes

Gate wajib: 100% skenario otorisasi, larangan mutation, dedup retry dan truthful failure lulus. Target kualitas pilot adalah sedikitnya 18 dari 20 pertanyaan uji dijawab benar menurut fixture; semua pertanyaan status/deadline kritis harus benar. Ukur latency median/P95, jumlah tool call dan bukti rute inferensi lokal dan biaya API Rp0; belum ada hasil atau SLA. Respons model lambat tidak boleh berubah menjadi laporan simpan sukses sebelum backend memberikan receipt.

### Kriteria tambahan versi 3

- FR43 Peran kanal. Website tetap mengelola data lengkap. Telegram melayani percakapan umum, pembacaan tracker dan capture draft; tidak ada fitur chat website yang diwajibkan.
- FR44 Akun Telegram. Bot khusus hanya dipakai owner dalam private chat. Akun lain ditolak sebelum pemanggilan model atau tool privat; uji grup tidak boleh membuka data tracker.
- FR45 Jawaban berbasis data. Pertanyaan status, deadline, kelayakan dan agenda mengambil hasil tool terbaru. Jawaban menyebut data_as_of, sumber bila relevan, serta unknown/partial/stale; memori chat tidak menjadi sumber fakta tracker.
- FR46 Capture Telegram. Permintaan eksplisit menyimpan link/teks menghasilkan draft dalam Inbox yang terlihat di website. Tautan tanpa niat simpan ditanyakan maksudnya; kegagalan ekstraksi tidak menghilangkan draft.
- FR47 Batas tindakan Hermes. Credential Hermes hanya memiliki opportunities:read, agenda:read dan drafts:create. Update stage, milestone, delete, export penuh dan akses token ditolak server meskipun diminta model atau pengguna lewat bot pada rilis ini.
- FR48 Retry capture. Retry sesudah response timeout mengembalikan draft yang sama. Link yang sama dari website dan Telegram tidak menciptakan dua peluang; kandidat ambigu masuk review dan tidak otomatis merge.
- FR49 Pemisahan runtime. Codex hanya membangun dan menguji repository. Tidak ada Codex runtime, shell coding, GitHub write atau deployment yang dipicu Telegram pada scope ini.
- FR50 Kegagalan Hermes. Hermes offline tidak memblokir website yang dihosting terpisah. Laptop mati berarti bot tidak tersedia; pesan tertunda tidak dijanjikan tersimpan tanpa batas. Backend gagal menghasilkan jawaban gagal yang jujur, bukan data rekaan.
- FR51 Satu pemilik integrasi. Satu Hermes gateway menerima update bot. Calendar hanya ditulis worker tracker. Riset harian existing tidak diduplikasi dengan Hermes cron; penanggung jawab jadwal tercatat.
- FR52 Credential dan pencabutan. Token integrasi diterbitkan melalui sesi owner, ditampilkan sekali, scope dibatasi, disimpan hash di server, punya expiry dan dapat dicabut. Rotasi tidak mengubah data peluang.
- FR53 Model dan biaya. Semua inferensi Hermes memakai model lokal di laptop dengan biaya API Rp0. Endpoint model utama dan tambahan dibatasi ke loopback; cloud fallback dinonaktifkan. Bila model berhenti, permintaan gagal secara eksplisit. Chat umum boleh tanpa tool; fakta terkini memerlukan sumber yang dapat diverifikasi.
- FR54 Health dan audit. Settings menampilkan status credential, waktu penggunaan API terakhir dan batas deteksi. Audit mencatat integration actor, request ID, hasil dan draft ID; tidak menyimpan token atau mengklaim user Telegram tertentu tanpa metadata terpercaya.
- FR55 Pemulihan dan perubahan versi. Revoke token, restart Hermes, replay request dan pemulihan database diuji. Grant yang dicabut tidak hidup lagi sesudah restore; capability baru tidak aktif diam-diam setelah upgrade.
- FR56 Pilot Windows. Owner dapat mengikuti panduan Windows native, membuat bot baru, menghubungkan provider, memverifikasi tool MCP dan menyimpan satu draft dari Telegram ke website. WSL tidak menjadi prasyarat default.

FR43–FR56 wajib untuk rilis pilot terintegrasi website dan Telegram. Website dapat diuji lebih dahulu dengan FR01–FR42, tetapi hasil itu tidak boleh diberi label bahwa integrasi Hermes sudah selesai. HERMES_TELEGRAM_CONTRACT.md menetapkan boundary API; ACCEPTANCE_TEST_PLAN.md memetakan semua FR, pengujian dan bukti.

## Kebutuhan nonfungsional dan pengukuran

Target di bawah adalah kriteria uji yang diusulkan. Hasil aktual harus diukur sebelum peluncuran.

| Area | Target atau aturan | Cara uji |
|---|---|---|
| Capture | Median simpan dari sumber terbaca maksimal 60 detik | 10 skenario link/teks dan fallback |
| Update progres | Median maksimal 15 detik | 10 tindakan dari detail/list |
| Respons UI | P95 list/detail maksimal 2 detik setelah sesi siap | Dataset 1000 peluang dan 5000 milestone; jaringan uji didokumentasikan |
| Ekstraksi | Timeout maksimal 60 detik; hasil parsial boleh | Halaman terbuka, tertutup, rusak, dan sumber panjang |
| Konflik | Semua kasus kritis FR10 sampai FR19 lulus | Fixture waktu, zona, recurrence, stale, dan self-conflict |
| Integritas | Nol kehilangan field pribadi pada impor/retry | Bandingkan sebelum/sesudah dan audit log |
| Mobile | Form utama bekerja pada lebar 390 px | Tanpa scroll horizontal halaman utama |
| Aksesibilitas | Label, fokus keyboard, kontras; warna bukan satu-satunya penanda | Uji keyboard dan pembaca layar dasar |
| Keamanan | Otorisasi server pada setiap akses data; token rahasia di server | Uji akses tanpa sesi dan ID yang tidak berhak |
| Kesehatan integrasi | Waktu sukses terakhir, error, retry, antrean terlihat | Simulasi token dicabut, timeout, dan kuota |

Ekstraksi AI bersifat opsional per capture dan memakai cache berdasarkan sumber/hash konten. Batas biaya harus dapat dikonfigurasi sebelum fitur berbayar diaktifkan. Ketika batas tercapai, sistem menawarkan tempel teks atau input manual tanpa menghilangkan draf. Situs tidak diakses dengan melewati login, CAPTCHA, atau pembatasan.

Data sumber dan konten eksternal diperlakukan sebagai data, bukan instruksi untuk menjalankan aksi. HTML dibersihkan. Pemroses URL hanya menerima HTTP/HTTPS publik dan memblokir alamat lokal/internal serta redirect ke jaringan privat. Unggahan MVP dibatasi tipe dan ukuran yang dikonfigurasi; file pribadi tidak tersedia lewat URL publik. Kredensial Google dan file rahasia tidak masuk log, ekspor, atau prompt ekstraksi.

## Migrasi dan rencana peluncuran

1. Bekukan pemetaan sumber. Inventaris tab, ID, field, formula turunan, serta Calendar ID lama. Hasil formula diimpor sebagai hasil atau dihitung ulang dengan aturan aplikasi; formula Excel bukan business logic runtime website.
2. Migrasikan ke staging. Pertahankan legacy ID dan timestamp. JOBS_BOOTCAMPS dipisah menurut kategori sebenarnya; COMPETITIONS tetap terpisah secara kategori. Nilai kosong tidak diisi dengan asumsi.
3. Rekonsiliasi. Bandingkan jumlah record, ID, tanggal aktual, kontak, tahapan, dan field pribadi. Identifikasi record ambigu serta calon duplikat sebelum penggabungan.
4. Periksa kalender lama. Event Apps Script atau sinkronisasi sebelumnya ditautkan hanya jika mapping dapat diverifikasi. Event tak dikenal tidak dihapus otomatis. Penulisan kalender baru ditahan sampai duplikasi ditinjau.
5. Lakukan cutover. Setelah rekonsiliasi lulus, website menjadi tempat pemeliharaan harian. Sheets riset tetap aktif sebagai jalur sementara; ekspor data website dipisahkan.
6. Uji pemulihan. Ekspor, patch darurat, pembatalan patch, reconnect, dan restore diuji. Rollback operasional memakai snapshot yang dipilih dan menghentikan penulisan integrasi sebelum rekonsiliasi.
7. Pantau pilot. Tinjau waktu input, kesalahan ekstraksi kritis, konflik, kegagalan sync, serta kebutuhan field setelah 14 hari penggunaan.

Urutan pengembangan adalah fondasi data dan form, progres dan milestone, Calendar dan bentrok, impor/ekspor/pemulihan, lalu uji penerimaan. Estimasi kalender pengerjaan disusun setelah stack, kapasitas pengembang, dan layanan ekstraksi dipilih.

## Risiko dan mitigasi

| Risiko | Dampak | Mitigasi dan kondisi peluncuran |
|---|---|---|
| Ekstraksi tanggal/biaya salah | Salah keputusan atau tenggat | Draf, provenance, review field kritis, unknown eksplisit |
| Dua sumber data utama | Progres tertimpa | Field ownership dan patch recovery berbasis revision |
| Calendar stale | Peringatan bentrok menyesatkan | Freshness, partial error, refresh, tidak mengklaim aman |
| Event ganda | Agenda dan reminder berulang | Mapping ID, rekonsiliasi kalender lama, retry idempotent |
| OAuth dicabut | Sync berhenti | Reconnect jelas; data lokal tetap tersimpan |
| Kapasitas unknown | Beban kerja diremehkan | Tampilkan total minimum dan komponen belum diketahui |
| Biaya layanan AI | Biaya melebihi rencana | Cap konfigurabel, cache, fallback manual |
| Backup tidak dapat direstore | Kehilangan data saat gangguan | Restore test menjadi syarat peluncuran |

## Syarat selesai dan keputusan teknis lanjutan

Website inti siap dipakai ketika seluruh FR01 sampai FR42 lulus, migrasi direkonsiliasi, integrasi Google diuji dengan akun pemilik, tidak ada duplikasi event yang belum diselesaikan pada agenda aktif, dan restore berhasil. Kegagalan ekstraksi atau Google tidak boleh menghilangkan hasil penyimpanan lokal. Perbedaan status personal dan status sumber harus terlihat pada detail peluang.

Pilot terintegrasi memerlukan tambahan FR43–FR56 dan uji live owner melalui Telegram. Uji model lokal pada hardware aktual, hosting website dan kredensial masih menunggu setup. Keputusan yang dapat ditetapkan pada desain teknis tanpa mengubah tujuan produk adalah hosting, detail layanan pendukung Next.js, penyedia ekstraksi serta batas biaya, format penyimpanan file, dan kebijakan retensi backup. Pilihan yang menyimpang dari default arsitektur dicatat dalam ADR dan diuji terhadap seluruh P0. Kapasitas waktu gabungan, kalender yang diperiksa, buffer perjalanan, serta jenis agenda yang dipublikasikan menjadi pengaturan saat onboarding. Angka default dalam PRD dapat diubah setelah uji pilot dengan histori perubahan spesifikasi.

## Referensi teknis

Referensi diperiksa pada 4 November 2026. Keputusan pengalaman pengguna dan target operasional dalam dokumen adalah rancangan produk; dokumentasi berikut mendukung kemampuan serta batas integrasi.

1. Google Calendar API. Choose Google Calendar API scopes. https://developers.google.com/workspace/calendar/api/auth
2. Google Calendar API. Events resource. https://developers.google.com/workspace/calendar/api/v3/reference/events
3. Google Calendar API. Freebusy query. https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
4. Google Calendar API. Synchronize resources efficiently. https://developers.google.com/workspace/calendar/api/guides/sync
5. Google Identity. Using OAuth 2.0 for Web Server Applications. https://developers.google.com/identity/protocols/oauth2/web-server
6. Google Sheets API. Usage limits. https://developers.google.com/workspace/sheets/api/limits


## Referensi tambahan versi 2

7. Next.js authentication. https://nextjs.org/docs/app/guides/authentication
8. Supabase Row Level Security. https://supabase.com/docs/guides/database/postgres/row-level-security
9. Supabase Cron. https://supabase.com/docs/guides/cron
10. Google Sheets scopes. https://developers.google.com/workspace/sheets/api/scopes
11. Apps Script CalendarEvent getId. https://developers.google.com/apps-script/reference/calendar/calendar-event#getId()
12. Google OAuth expiration. https://developers.google.com/identity/protocols/oauth2#expiration

Referensi Hermes dan Codex yang diperiksa 5 November 2026 terdapat pada SOURCES_AND_VERSION_NOTES.md. Panduan koneksi berada pada SETUP_HERMES_TELEGRAM_CODEX.md.
