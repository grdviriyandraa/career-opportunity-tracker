import Link from "next/link";
export default function NotFound() {
  return (
    <section className="card">
      <h1>Halaman tidak ditemukan</h1>
      <Link href="/">Kembali ke Overview</Link>
    </section>
  );
}
