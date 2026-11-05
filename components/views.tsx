import Link from "next/link";
import { AgentSettings } from "./agent-settings";
import { MilestoneControls } from "./milestone-controls";
import { ArrowUpRight } from "./icons";
import { Capture, Login, Logout } from "./forms";
import { configuration, setupIssues } from "@/lib/config";
import { HttpError, owner } from "@/lib/server";
import {
  categoryLabels,
  stageLabels,
  type Milestone,
  type Opportunity,
} from "@/lib/domain";
export function Setup() {
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">MULAI DARI SINI</span>
        <h1>Siapkan ruang peluang Anda</h1>
        <p>
          Fondasi tersedia. Hubungkan database dan akun owner untuk mulai
          menyimpan.
        </p>
      </div>
      <section className="card">
        <span className="badge">Setup diperlukan</span>
        <h2>Hubungkan Supabase</h2>
        <ol className="steps">
          <li>
            Salin <code>.env.example</code> menjadi <code>.env.local</code>,
            lalu isi konfigurasi Supabase dan owner.
          </li>
          <li>
            Jalankan migrasi SQL, provision satu akun owner, dan nonaktifkan
            public signup.
          </li>
          <li>
            Masukkan UUID owner ke tabel profiles melalui SQL editor. Atur
            template email Supabase untuk menampilkan kode OTP.
          </li>
          <li>Restart server, lalu masuk melalui email owner.</li>
        </ol>
        <p>Konfigurasi yang belum valid:</p>
        <ul>
          {setupIssues().map((n) => (
            <li key={n}>
              <code>{n}</code>
            </li>
          ))}
        </ul>
        <p className="muted">
          Belum ada penyimpanan yang aktif. Lihat README untuk langkah lengkap.
          Google dan Hermes dikonfigurasi pada tahap terpisah.
        </p>
      </section>
    </>
  );
}
export async function gate() {
  if (!configuration()) return { screen: <Setup /> };
  try {
    const s = await owner();
    return { session: s };
  } catch (e) {
    if (e instanceof HttpError && e.status === 401)
      return { screen: <Login /> };
    return {
      screen: (
        <section className="card">
          <h1>Akses belum tersedia</h1>
          <p role="alert">
            {e instanceof HttpError
              ? e.message
              : "Layanan autentikasi tidak dapat dijangkau."}
          </p>
          <Link href="/">Coba lagi</Link>
        </section>
      ),
    };
  }
}
export function PageHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <span className="eyebrow">PELUANG, DENGAN ARAH</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
export function DatabaseFailure() {
  return (
    <section className="card">
      <h2>Database belum dapat dibaca</h2>
      <p role="alert">
        Periksa migrasi dan koneksi Supabase. Data tidak diganti dengan data
        contoh.
      </p>
      <Link href="/">Coba lagi</Link>
    </section>
  );
}
export function OpportunityList({ items }: { items: Opportunity[] }) {
  return (
    <section className="card list">
      <div className="section-heading">
        <h2>Peluang tersimpan</h2>
        <span className="muted">{items.length} pada halaman ini</span>
      </div>
      {!items.length ? (
        <div className="empty">
          <ArrowUpRight />
          <h3>Ruang untuk peluang berikutnya</h3>
          <p>
            Simpan link atau teks di Inbox. Anda bisa melengkapi detail nanti.
          </p>
          <Link href="/inbox">Buka Inbox →</Link>
        </div>
      ) : (
        items.map((o) => (
          <Link
            className="opportunity-row"
            key={o.id}
            href={"/opportunities/" + o.id}
          >
            <span className="category-icon">
              {o.category === "job" ? (
                "J"
              ) : o.category === "bootcamp" ? (
                "B"
              ) : o.category === "competition" ? (
                "C"
              ) : (
                <ArrowUpRight />
              )}
            </span>
            <div>
              <h3>{o.title ?? o.source_url ?? "Draft tanpa judul"}</h3>
              <p>
                {o.organization ?? "Organisasi belum diketahui"} ·{" "}
                {o.category
                  ? categoryLabels[o.category]
                  : "Belum diklasifikasi"}
              </p>
            </div>
            <span className="badge">{stageLabels[o.personal_stage]}</span>
            <ArrowUpRight />
          </Link>
        ))
      )}
    </section>
  );
}
export function Milestones({
  items,
  manage,
}: {
  items: Milestone[];
  manage?: { opportunityRevision: number };
}) {
  return (
    <section className="card">
      <div className="section-heading">
        <h2>Agenda internal</h2>
        <span className="badge">Google belum terhubung</span>
      </div>
      <p className="muted">
        Kesibukan kalender pribadi belum diperiksa. Agenda ini belum mencakup
        pengulangan dan pengecualian sesi.
      </p>
      {!items.length ? (
        <div className="empty">
          <h3>Belum ada milestone</h3>
          <p>Tambahkan deadline atau acara dari halaman detail peluang.</p>
        </div>
      ) : (
        items.map((m) => (
          <div key={m.id}>
            <div className="agenda-row">
              <div>
                <Link href={"/opportunities/" + m.opportunity_id}>
                  <strong>{m.title}</strong>
                </Link>
                <p>
                  {m.kind === "deadline" ? "Deadline" : "Acara"} ·{" "}
                  {m.cancelled_at && (
                    <span className="badge">Dibatalkan · </span>
                  )}
                  {m.attendance === "confirmed"
                    ? "Terkonfirmasi"
                    : m.attendance === "conditional"
                      ? "Bersyarat"
                      : "Partisipasi belum diketahui"}
                </p>
              </div>
              <div>
                {m.precision === "date" ? (
                  <>
                    <time>{m.date}</time>
                    <small>Jam belum diketahui</small>
                  </>
                ) : (
                  <>
                    <time>
                      {new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: m.timezone,
                      }).format(new Date(m.start_at!))}
                      {m.kind === "event" &&
                        m.end_at &&
                        " sampai " +
                          new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: m.timezone,
                          }).format(new Date(m.end_at))}
                    </time>
                    <small>{m.timezone}</small>
                  </>
                )}
              </div>
            </div>
            {manage && (
              <MilestoneControls
                key={m.id + ":" + m.revision + ":" + manage.opportunityRevision}
                milestone={m}
                opportunityRevision={manage.opportunityRevision}
              />
            )}
          </div>
        ))
      )}
    </section>
  );
}
export async function Settings() {
  const { db } = await owner();
  const grants = await db.rpc("list_agent_grants");
  return (
    <>
      <PageHeading
        title="Settings"
        description="Konfigurasi akun dan status koneksi yang sebenarnya."
      />
      <section className="card">
        <h2>Akun owner</h2>
        <p>
          Sesi diverifikasi oleh Supabase Auth. Akses database dibatasi dengan
          RLS.
        </p>
        <p>
          Batas pekerjaan: 20 jam/minggu. Kapasitas total: belum ditentukan.
        </p>
        <Logout />
      </section>
      <AgentSettings initialItems={grants.error ? null : grants.data} />
      <section className="card">
        <h2>Integrasi</h2>
        {[
          [
            "Google Calendar",
            "Belum diimplementasikan. Tidak ada kalender yang ditulis.",
          ],
          [
            "Google Sheets",
            "Belum terhubung. Impor snapshot JSON melalui preview tersedia di Inbox. Tracker riset existing tetap terpisah.",
          ],
          [
            "Ekstraksi dan AI",
            "Input manual. Tidak ada fetch sumber atau panggilan model.",
          ],
          [
            "Backup",
            "Belum dijadwalkan. Snapshot environment bukan backup data aplikasi.",
          ],
        ].map(([title, desc]) => (
          <div className="agenda-row" key={title}>
            <div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
            <span className="badge">Belum aktif</span>
          </div>
        ))}
      </section>
    </>
  );
}
export { Capture };
