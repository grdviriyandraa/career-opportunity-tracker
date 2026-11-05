import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ArrowUpRight } from "@/components/icons";
export const metadata: Metadata = {
  title: "Career Opportunity Tracker",
  description: "Ruang pribadi untuk peluang dan langkah berikutnya.",
  robots: { index: false, follow: false },
};
const links = [
  ["/", "Overview", "01"],
  ["/inbox", "Inbox", "02"],
  ["/jobs", "Jobs", "03"],
  ["/bootcamps", "Bootcamps", "04"],
  ["/competitions", "Competitions", "05"],
  ["/agenda", "Agenda", "06"],
  ["/settings", "Settings", "07"],
];
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <a href="#main" className="skip">
          Langsung ke konten
        </a>
        <div className="shell">
          <aside>
            <Link className="brand" href="/">
              <span className="brand-icon">
                <ArrowUpRight size={26} />
              </span>
              <span>
                Opportunity<span className="brand-sub">CAREER TRACKER</span>
              </span>
            </Link>
            <p className="nav-label">RUANG KERJA</p>
            <nav aria-label="Menu utama">
              {links.map(([href, label, n]) => (
                <Link key={href} href={href}>
                  <span aria-hidden="true" className="nav-num">
                    {n}
                  </span>
                  {label}
                </Link>
              ))}
            </nav>
            <div className="aside-note">
              <span className="dot" /> Satu langkah lebih dekat
              <p>
                Simpan peluang.
                <br />
                Pilih langkah berikutnya.
              </p>
            </div>
          </aside>
          <div className="workspace">
            <header>
              <span>Workspace pribadi</span>
              <span className="header-tag">LOCAL DEVELOPMENT</span>
            </header>
            <main id="main">{children}</main>
            <footer>
              Career Opportunity Tracker{" "}
              <span>Data utama tersimpan di database server.</span>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
