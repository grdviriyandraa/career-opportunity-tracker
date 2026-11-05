import Link from "next/link";
import { ResearchReview } from "@/components/research-review";
import { ArrowUpRight } from "@/components/icons";
import { z } from "zod";
import { notFound } from "next/navigation";
import {
  gate,
  DatabaseFailure,
  Milestones,
  PageHeading,
} from "@/components/views";
import { AddMilestone, EditOpportunity } from "@/components/forms";
import type { Milestone, Opportunity } from "@/lib/domain";
export const dynamic = "force-dynamic";
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;
  if (!z.uuid().safeParse(id).success) notFound();
  const g = await gate();
  if (g.screen) return g.screen;
  const db = g.session!.db;
  const [result, milestones, history, proposals] = await Promise.all([
    db.from("opportunities").select("*").eq("id", id).maybeSingle(),
    db.from("milestones").select("*").eq("opportunity_id", id).order("date"),
    db
      .from("change_history")
      .select("id,operation,created_at")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("research_proposals")
      .select("*")
      .eq("opportunity_id", id)
      .eq("status", "pending")
      .limit(21),
  ]);
  if (proposals.error) return <DatabaseFailure />;
  if (result.error || milestones.error || history.error)
    return <DatabaseFailure />;
  if (!result.data) notFound();
  const item = result.data as Opportunity;
  return (
    <>
      <Link href="/inbox" className="back">
        ← Kembali ke Inbox
      </Link>
      <PageHeading
        title={item.title ?? "Draft peluang"}
        description={
          "Revisi " +
          item.revision +
          " · Perubahan disimpan ke database server."
        }
      />
      <section className="card">
        <h2>Sumber asli</h2>
        {item.source_url && (
          <a href={item.source_url} target="_blank" rel="noreferrer noopener">
            Buka link sumber <ArrowUpRight />
          </a>
        )}
        {item.source_text && <p className="source-text">{item.source_text}</p>}
        <p className="muted">
          Belum diekstraksi atau diverifikasi. Membuka sumber tidak mencatat
          tindakan melamar.
        </p>
      </section>
      {proposals.data?.slice(0, 20).map((p) => (
        <ResearchReview
          key={p.id + ":" + item.revision}
          proposal={p}
          item={item}
        />
      ))}
      {(proposals.data?.length ?? 0) > 20 && (
        <p className="muted">
          Menampilkan 20 usulan. Usulan berikutnya muncul setelah review.
        </p>
      )}
      <EditOpportunity key={item.revision} item={item} />
      <p>
        <Link href="/agenda" className="text-link">
          Periksa bentrok di Agenda →
        </Link>
      </p>
      <Milestones
        items={milestones.data as Milestone[]}
        manage={{ opportunityRevision: item.revision }}
      />
      <AddMilestone
        key={"milestone-" + item.revision}
        id={id}
        revision={item.revision}
      />
      <section className="card">
        <h2>Riwayat perubahan</h2>
        <p className="muted">Menampilkan hingga 50 aktivitas terbaru.</p>
        {history.data?.map((h) => (
          <div className="agenda-row" key={h.id}>
            <span>
              {h.operation === "capture"
                ? "Draft disimpan"
                : h.operation === "update"
                  ? "Detail / progres diperbarui"
                  : h.operation === "milestone_added"
                    ? "Milestone ditambahkan"
                    : h.operation === "milestone_updated"
                      ? "Milestone diperbarui"
                      : h.operation === "milestone_cancelled"
                        ? "Milestone dibatalkan"
                        : h.operation === "milestone_restored"
                          ? "Milestone dipulihkan"
                          : h.operation === "research_capture"
                            ? "Peluang diimpor dari riset"
                            : h.operation === "research_public_approved"
                              ? "Fakta sumber disetujui"
                              : h.operation}
            </span>
            <time>
              {new Intl.DateTimeFormat("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Jakarta",
              }).format(new Date(h.created_at))}{" "}
              WIB
            </time>
          </div>
        ))}
      </section>
    </>
  );
}
