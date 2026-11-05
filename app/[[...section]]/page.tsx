import Link from "next/link";
import { AgendaWorkspace } from "@/components/agenda-view";
import { ResearchImport } from "@/components/research-import";
import { LatestResearch, ResearchHistory } from "@/components/research-history";
import { ArrowUpRight } from "@/components/icons";
import { notFound } from "next/navigation";
import {
  Capture,
  DatabaseFailure,
  gate,
  OpportunityList,
  PageHeading,
  Settings,
} from "@/components/views";
import type { Opportunity } from "@/lib/domain";
export const dynamic = "force-dynamic";
const pages: Record<string, [string, string, Opportunity["category"]]> = {
  overview: [
    "Langkah berikutnya dimulai di sini",
    "Kumpulkan peluang, tinjau prioritas, dan jaga progres Anda.",
    null,
  ],
  inbox: ["Inbox", "Simpan dulu. Tinjau dan lengkapi saat Anda siap.", null],
  jobs: ["Jobs", "Pekerjaan yang sesuai arah dan kapasitas Anda.", "job"],
  bootcamps: [
    "Bootcamps",
    "Program belajar, dengan waktu dan komitmen yang jelas.",
    "bootcamp",
  ],
  competitions: [
    "Competitions",
    "Pantau tahapan, deliverable, dan deadline kompetisi.",
    "competition",
  ],
  agenda: ["Agenda", "Deadline dan acara dari peluang Anda.", null],
  settings: ["Settings", "", null],
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{
    q?: string;
    before?: string;
    archived?: string;
    run?: string;
    history_page?: string;
    items_page?: string;
    start?: string;
    days?: string;
    buffer_before?: string;
    buffer_after?: string;
  }>;
}) {
  const segments = (await params).section ?? [];
  const section = segments[0] ?? "overview";
  if (segments.length > 1 || !pages[section]) notFound();
  const g = await gate();
  if (g.screen) return g.screen;
  const db = g.session!.db;
  if (section === "settings") return <Settings />;
  const [title, description, category] = pages[section];
  if (section === "agenda") {
    return (
      <>
        <PageHeading title={title} description={description} />
        <AgendaWorkspace db={db} query={await searchParams} />
      </>
    );
  }
  const search = await searchParams;
  let query = db
    .from("opportunities")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(51);
  if (category) query = query.eq("category", category);
  if (search.archived === "true") query = query.not("archived_at", "is", null);
  else query = query.is("archived_at", null);
  if (search.q)
    query = query.ilike(
      "title",
      "%" + search.q.replace(/[%_\\]/g, "").slice(0, 200) + "%",
    );
  if (search.before && !Number.isNaN(Date.parse(search.before)))
    query = query.lt("created_at", search.before);
  const { data, error } = await query;
  const rows = (data ?? []) as Opportunity[];
  const items = rows.slice(0, 50);
  return (
    <>
      <PageHeading title={title} description={description} />
      {section === "inbox" && (
        <>
          <Capture />
          <ResearchHistory
            db={db}
            runId={search.run}
            page={
              Math.max(0, Math.min(50000, Number(search.history_page) || 0)) | 0
            }
            itemPage={
              Math.max(0, Math.min(50000, Number(search.items_page) || 0)) | 0
            }
          />
          <ResearchImport />
        </>
      )}
      {section === "overview" && <LatestResearch db={db} />}
      {section === "overview" && (
        <div className="welcome">
          <div>
            <span className="eyebrow">BUAT RUANG UNTUK LANGKAH BARU</span>
            <h2>Peluang bagus layak ditindaklanjuti.</h2>
            <p>
              Simpan hal yang menarik sekarang.
              <br />
              Ubah menjadi langkah yang terencana.
            </p>
            <Link className="button" href="/inbox">
              + Simpan peluang
            </Link>
          </div>
          <div aria-hidden className="welcome-art">
            <ArrowUpRight size={80} />
            <span>
              YOUR NEXT
              <br />
              CHAPTER
            </span>
          </div>
        </div>
      )}
      <form className="search">
        <label>
          Cari judul
          <input name="q" defaultValue={search.q} placeholder="Cari peluang…" />
        </label>
        <label>
          Tampilkan
          <select name="archived" defaultValue={search.archived ?? "false"}>
            <option value="false">Aktif</option>
            <option value="true">Arsip</option>
          </select>
        </label>
        <button className="secondary">Terapkan</button>
      </form>
      {error ? <DatabaseFailure /> : <OpportunityList items={items} />}{" "}
      {rows.length > 50 && (
        <Link
          className="button secondary"
          href={
            "?" +
            new URLSearchParams({
              ...(search.q ? { q: search.q } : {}),
              archived: search.archived ?? "false",
              before: items[49].created_at,
            })
          }
        >
          Halaman berikutnya →
        </Link>
      )}
    </>
  );
}
