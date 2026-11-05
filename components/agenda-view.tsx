import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { AgendaReport, AgendaAlert } from "@/lib/agenda";
import { loadAgenda } from "@/lib/agenda-server";
import { HttpError } from "@/lib/server";
import { DatabaseFailure, Milestones } from "./views";
const labels: Record<AgendaAlert["kind"], string> = {
  confirmed_overlap: "Bentrok pasti",
  potential_overlap: "Potensi bentrok",
  buffer_warning: "Buffer beririsan",
  deadline_cluster: "Deadline berdekatan (≤48 jam)",
  potential_deadline_cluster:
    "Potensi deadline berdekatan — jam belum diketahui",
};
function Filters({
  query,
  report,
}: {
  query: Record<string, unknown>;
  report?: AgendaReport;
}) {
  const value = (name: string, fallback: string | number) =>
    typeof query[name] === "string" ? String(query[name]) : fallback;
  return (
    <form className="card agenda-filters" action="/agenda">
      <h2>Periksa jadwal</h2>
      <div className="form-grid">
        <label>
          Mulai tanggal
          <input
            type="date"
            name="start"
            defaultValue={report?.window_start_date ?? value("start", "")}
            required
          />
        </label>
        <label>
          Rentang (hari)
          <input
            name="days"
            type="number"
            min={1}
            max={180}
            required
            defaultValue={value("days", 180)}
          />
        </label>
        <label>
          Buffer sebelum (menit)
          <input
            name="buffer_before"
            type="number"
            min={0}
            max={120}
            required
            defaultValue={value("buffer_before", 0)}
          />
        </label>
        <label>
          Buffer sesudah (menit)
          <input
            name="buffer_after"
            type="number"
            min={0}
            max={120}
            required
            defaultValue={value("buffer_after", 0)}
          />
        </label>
      </div>
      <p className="muted">
        Buffer berlaku pada kedua acara untuk pemeriksaan ini; tidak mengubah
        jadwal tersimpan atau menghitung rute perjalanan.
      </p>
      <button>Periksa jadwal</button>
    </form>
  );
}
function Alerts({
  items,
  report,
  title,
}: {
  items: AgendaAlert[];
  report: AgendaReport;
  title: string;
}) {
  const byId = new Map(report.items.map((m) => [m.id, m]));
  return (
    <section className="card agenda-alerts">
      <div className="section-heading">
        <h2>{title}</h2>
        <span className="badge">{items.length} ditampilkan</span>
      </div>
      {items.length ? (
        items.map((a) => {
          const first = byId.get(a.first_id)!,
            second = byId.get(a.second_id)!;
          return (
            <article
              key={a.first_id + ":" + a.second_id}
              className={
                "agenda-alert " +
                (a.kind === "confirmed_overlap" ? "definite" : "potential")
              }
            >
              <span className="badge">{labels[a.kind]}</span>
              <p>
                <Link href={"/opportunities/" + first.opportunity_id}>
                  {first.title}
                </Link>
                <span> dan </span>
                <Link href={"/opportunities/" + second.opportunity_id}>
                  {second.title}
                </Link>
              </p>
            </article>
          );
        })
      ) : (
        <p className="muted">
          Tidak ada peringatan jenis ini pada data yang diperiksa. Ini belum
          membuktikan keseluruhan jadwal bebas bentrok.
        </p>
      )}
    </section>
  );
}
export async function AgendaWorkspace({
  db,
  query,
}: {
  db: SupabaseClient<Database>;
  query: Record<string, unknown>;
}) {
  let report: AgendaReport;
  try {
    report = await loadAgenda(db, query);
  } catch (e) {
    return (
      <>
        <Filters query={query} />
        {e instanceof HttpError && e.status === 400 ? (
          <section className="card">
            <p className="error" role="alert">
              {e.message}
            </p>
          </section>
        ) : (
          <DatabaseFailure />
        )}
      </>
    );
  }
  return (
    <>
      <Filters query={query} report={report} />
      <section className="card agenda-coverage">
        <div className="section-heading">
          <h2>Cakupan pemeriksaan</h2>
          <span className="badge">Internal saja</span>
        </div>
        <p>
          <strong>{report.window_start_date}</strong> sampai{" "}
          <strong>{report.window_end_date_exclusive}</strong> (batas akhir tidak
          termasuk), zona {report.timezone}.
        </p>
        <dl className="agenda-coverage-grid">
          <div>
            <dt>Data internal</dt>
            <dd>
              {report.items.length} milestone dalam rentang dari{" "}
              {report.loaded_count} dimuat
            </dd>
            <small>
              {report.internal_data_complete
                ? "Seluruh data yang dimuat telah diperiksa"
                : "Hasil internal belum lengkap"}
            </small>
          </div>
          <div>
            <dt>Kalender pribadi</dt>
            <dd>Belum terhubung</dd>
            <small>Kesibukan eksternal belum dapat dipastikan</small>
          </div>
        </dl>
        <p className="muted">
          Diperiksa{" "}
          {new Intl.DateTimeFormat("id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: report.timezone,
          }).format(new Date(report.checked_at))}
          . Tanggal tanpa jam bukan komitmen satu hari penuh. Deadline tidak
          dihitung sebagai durasi kerja.
        </p>
        {report.source_truncated && (
          <p className="error" role="alert">
            Batas 1.000 milestone yang dimuat tercapai; jadwal lain belum
            diperiksa. Pembacaan semua halaman akan tersedia pada tahap
            berikutnya.
          </p>
        )}
        {!!report.invalid_milestone_ids.length && (
          <p className="error" role="alert">
            {report.invalid_milestone_ids.length} milestone tidak dapat dibaca
            secara valid. Periksa presisi, interval dan zona waktu.
          </p>
        )}
        {report.alerts_truncated && (
          <p className="error" role="alert">
            Daftar peringatan dibatasi. Masih ada pasangan lain yang belum
            ditampilkan.
          </p>
        )}
        <p className="muted">
          Pemeriksaan saat ini memakai milestone tersimpan. Pengulangan sesi,
          status pembatalan, workload mingguan dan Google FreeBusy belum
          tersedia.
        </p>
      </section>
      <Alerts
        title="Bentrok acara internal"
        report={report}
        items={report.conflicts}
      />
      <Alerts
        title="Tenggat berdekatan"
        report={report}
        items={report.deadline_clusters}
      />
      <Milestones items={report.items} />
    </>
  );
}
