"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="card">
      <h1>Halaman belum dapat dimuat</h1>
      <p role="alert">
        Periksa koneksi, lalu coba lagi. Perubahan yang belum berhasil disimpan
        perlu ditinjau.
      </p>
      <button onClick={reset}>Coba lagi</button>
    </section>
  );
}
