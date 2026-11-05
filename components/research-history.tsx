import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  classificationLabels,
  classifications,
  type ResearchRun,
  type ResearchItem,
} from "@/lib/research";
import { DatabaseFailure } from "./views";
import { z } from "zod";
export function sourceTime(value: string, zone = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zone,
  }).format(new Date(value));
}
export function ResearchSummary({
  run,
  compact = false,
}: {
  run: ResearchRun;
  compact?: boolean;
}) {
  return (
    <section className="card research-summary">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            SNAPSHOT SUMBER • BUKAN VERIFIKASI LIVE
          </span>
          <h2>
            {compact
              ? "Snapshot riset terakhir diimpor"
              : "Ringkasan run " + run.run_id}
          </h2>
        </div>
        <span className="badge">{run.source_system}</span>
      </div>
      <p className="source-stamp">
        Waktu riset:{" "}
        <strong>{sourceTime(run.source_as_of, run.source_timezone)}</strong> ·{" "}
        {run.source_timezone}
        <br />
        Diimpor: {sourceTime(run.imported_at)} · Asia/Jakarta
      </p>
      <dl className="research-metrics">
        <div>
          <dt>Inventaris sumber</dt>
          <dd>{run.inventory_total}</dd>
          <small>Total pada snapshot ini</small>
        </div>
        <div>
          <dt>Pemeriksaan sumber</dt>
          <dd>{run.sources_checked}</dd>
          <small>
            {run.new_count} baru + {run.enriched_count} lama diperiksa
          </small>
        </div>
        <div>
          <dt>Memakai hasil lama</dt>
          <dd>{run.carry_forward}</dd>
          <small>Bukan pemeriksaan baru</small>
        </div>
      </dl>
      <dl className="classification-grid">
        {classifications.map((c) => (
          <div key={c}>
            <dt>{classificationLabels[c]}</dt>
            <dd>{run.snapshot[c]}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">
        High Priority aktif:{" "}
        <strong>{run.high_priority_active ?? "Tidak dilaporkan"}</strong> —
        indikator terpisah, tidak ditambahkan ke total klasifikasi.
      </p>
      {!compact && (
        <>
          <p className="muted">Cakupan: {run.coverage ?? "Tidak dilaporkan"}</p>
          <p className="muted">
            Batasan:{" "}
            {run.limitations === null
              ? "Tidak dilaporkan"
              : run.limitations.length
                ? run.limitations.join(" · ")
                : "Tidak ada yang dilaporkan sumber"}
          </p>
          <p className="muted">
            Baru ditemukan tidak berarti baru dipublikasikan. Status sumber
            berbeda dari progres pribadi. Waktu impor tidak memperbarui waktu
            pemeriksaan sumber.
          </p>
        </>
      )}
      {compact && (
        <Link className="text-link" href={"/inbox?run=" + run.id}>
          Lihat snapshot dan riwayat di Inbox →
        </Link>
      )}
    </section>
  );
}
export async function LatestResearch({ db }: { db: SupabaseClient<Database> }) {
  const { data, error } = await db
    .from("research_runs")
    .select("*")
    .order("imported_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) return <DatabaseFailure />;
  if (!data?.length)
    return (
      <section className="card">
        <h2>Belum ada snapshot riset</h2>
        <p className="muted">
          Riwayat dan angka riset akan tampil setelah impor ditinjau. Koneksi
          Sheets belum aktif; tidak ada angka contoh yang dimuat sebagai data
          pribadi.
        </p>
        <Link className="text-link" href="/inbox">
          Buka Inbox untuk impor manual →
        </Link>
      </section>
    );
  return <ResearchSummary run={data[0]} compact />;
}
function PageLinks({
  page,
  hasNext,
  path,
  param,
}: {
  page: number;
  hasNext: boolean;
  path: string;
  param: string;
}) {
  const separator = path.includes("?") ? "&" : "?";
  return (
    <div className="pagination">
      {page > 0 && (
        <Link href={path + separator + param + "=" + (page - 1)}>
          ← Sebelumnya
        </Link>
      )}
      <span>Halaman {page + 1}</span>
      {hasNext && (
        <Link href={path + separator + param + "=" + (page + 1)}>
          Berikutnya →
        </Link>
      )}
    </div>
  );
}
export async function ResearchHistory({
  db,
  runId,
  page = 0,
  itemPage = 0,
}: {
  db: SupabaseClient<Database>;
  runId?: string;
  page?: number;
  itemPage?: number;
}) {
  const listing = await db
    .from("research_runs")
    .select("*")
    .order("imported_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * 20, page * 20 + 20);
  if (listing.error) return <DatabaseFailure />;
  const runs = listing.data ?? [];
  const invalidId = runId && !z.uuid().safeParse(runId).success;
  let selected =
    runs.find((r) => r.id === runId) ?? (!runId ? runs[0] : undefined);
  if (runId && !invalidId && !selected) {
    const older = await db
      .from("research_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    if (older.error) return <DatabaseFailure />;
    selected = older.data ?? undefined;
  }
  if (!runs.length && !runId)
    return (
      <section className="card">
        <h2>Riwayat riset</h2>
        <p className="muted">
          Belum ada run tersimpan. Impor snapshot JSON melalui preview di bawah.
          Data contoh tidak diimpor otomatis.
        </p>
      </section>
    );
  const [items, corrections, proposals] = selected
    ? await Promise.all([
        db
          .from("research_items")
          .select("*")
          .eq("research_run_id", selected.id)
          .order("external_id")
          .range(itemPage * 50, itemPage * 50 + 50),
        db
          .from("research_corrections")
          .select("*")
          .eq("research_run_id", selected.id)
          .order("created_at", { ascending: false })
          .limit(21),
        db
          .from("research_proposals")
          .select("*")
          .eq("research_run_id", selected.id)
          .eq("status", "pending")
          .limit(21),
      ])
    : [];
  return (
    <>
      <section className="card">
        <div className="section-heading">
          <h2>Riwayat riset</h2>
          <span className="badge">Snapshot tersimpan</span>
        </div>
        <p className="muted">
          Pilih satu run untuk melihat inventaris dan pemeriksaan pada waktu
          itu.
        </p>
        <div className="run-picker">
          {runs.slice(0, 20).map((r) => (
            <Link
              aria-current={r.id === selected?.id ? "page" : undefined}
              key={r.id}
              href={"/inbox?run=" + r.id + "&history_page=" + page}
            >
              <strong>{r.run_id}</strong>
              <small>
                {sourceTime(r.source_as_of, r.source_timezone)} ·{" "}
                {r.inventory_total} inventaris
              </small>
            </Link>
          ))}
        </div>
        <PageLinks
          page={page}
          hasNext={runs.length > 20}
          path="/inbox"
          param="history_page"
        />
      </section>
      {!selected ? (
        <section className="card">
          <p role="alert">Run tidak ditemukan atau tidak dapat diakses.</p>
        </section>
      ) : items?.error || corrections?.error || proposals?.error ? (
        <DatabaseFailure />
      ) : (
        <>
          <ResearchSummary run={selected} />
          {!!proposals?.data?.length && (
            <section className="card notice">
              <h3>Fakta sumber menunggu review</h3>
              <p>
                {proposals.data.length > 20 ? "20+" : proposals.data.length}{" "}
                usulan tersimpan. Nilai peluang dan progres pribadi belum
                ditimpa. Buka detail peluang untuk membandingkan dan menerapkan
                field pilihan.
              </p>
              <div className="proposal-links">
                {proposals.data.slice(0, 20).map((p) => (
                  <Link
                    className="text-link"
                    key={p.id}
                    href={"/opportunities/" + p.opportunity_id}
                  >
                    Review peluang →
                  </Link>
                ))}
              </div>
            </section>
          )}
          {!!corrections?.data?.length && (
            <section className="card notice">
              <h3>Koreksi run menunggu review</h3>
              <p>
                {corrections.data.length > 20 ? "20+" : corrections.data.length}{" "}
                versi payload berbeda tersimpan. Snapshot asli tetap menjadi
                referensi; penerapan koreksi belum tersedia.
              </p>
            </section>
          )}
          <section className="card">
            <h2>Item pada snapshot</h2>
            <p className="muted">
              Pemeriksaan pada run ini dan hasil lama ditandai terpisah. Detail
              peluang menunjukkan progres pribadi terkini.
            </p>
            <div className="snapshot-items">
              {(items?.data ?? []).slice(0, 50).map((i: ResearchItem) => (
                <article className="snapshot-item" key={i.id}>
                  <div className="section-heading">
                    <Link href={"/opportunities/" + i.opportunity_id}>
                      <strong>
                        {i.public_snapshot.title ?? i.external_id}
                      </strong>
                    </Link>
                    <span
                      className={
                        "badge " +
                        (i.action === "carry_forward" ? "neutral" : "")
                      }
                    >
                      {i.action === "new"
                        ? "Baru ditemukan"
                        : i.action === "enriched"
                          ? "Lama diperiksa"
                          : "Hasil lama"}
                    </span>
                  </div>
                  <p>
                    {i.external_id} ·{" "}
                    {i.public_snapshot.organization ??
                      "Organisasi belum diketahui"}{" "}
                    · {classificationLabels[i.public_snapshot.classification]}
                  </p>
                  <dl>
                    <div>
                      <dt>Pertama ditemukan</dt>
                      <dd>{i.first_seen_at ?? "Belum diketahui"}</dd>
                    </div>
                    <div>
                      <dt>Terakhir diperiksa sumber</dt>
                      <dd>
                        {i.last_source_checked_at
                          ? sourceTime(
                              i.last_source_checked_at,
                              selected.source_timezone,
                            )
                          : "Belum diketahui"}
                      </dd>
                    </div>
                    <div>
                      <dt>Diperiksa pada run ini</dt>
                      <dd>
                        {i.checked_at
                          ? sourceTime(i.checked_at, selected.source_timezone)
                          : "Tidak — menggunakan hasil lama"}
                      </dd>
                    </div>
                  </dl>
                  <p className="muted">
                    Dipublikasikan:{" "}
                    {i.public_snapshot.published_at ?? "Belum diketahui"} ·
                    Deadline resmi:{" "}
                    {i.public_snapshot.official_deadline ?? "Belum diketahui"}
                  </p>
                  <a
                    className="text-link"
                    href={i.public_snapshot.source_url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Buka bukti sumber
                  </a>
                </article>
              ))}
            </div>
            <PageLinks
              page={itemPage}
              hasNext={(items?.data?.length ?? 0) > 50}
              path={"/inbox?run=" + selected.id + "&history_page=" + page}
              param="items_page"
            />
          </section>
        </>
      )}
    </>
  );
}
