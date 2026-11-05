"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Milestone } from "@/lib/domain";
import { MilestoneForm } from "./forms";
export function MilestoneControls({
  milestone,
  opportunityRevision,
}: {
  milestone: Milestone;
  opportunityRevision: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const revision = milestone.revision;
  if (!Number.isInteger(revision) || !revision)
    return (
      <p>Revisi milestone belum tersedia; muat ulang detail untuk mengedit.</p>
    );
  const cancelled = !!milestone.cancelled_at;
  return (
    <div role="group" aria-label={"Kelola milestone: " + milestone.title}>
      {!cancelled && (
        <details>
          <summary>Edit milestone</summary>
          <MilestoneForm
            id={milestone.opportunity_id}
            revision={opportunityRevision}
            milestone={{ ...milestone, revision }}
          />
        </details>
      )}
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const response = await fetch(
              `/api/opportunities/${milestone.opportunity_id}/milestones/${milestone.id}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  expected_revision: opportunityRevision,
                  expected_milestone_revision: revision,
                  cancelled: !cancelled,
                }),
              },
            );
            const data = await response.json();
            if (!response.ok)
              throw new Error(
                data.message ?? "Milestone belum dapat diperbarui.",
              );
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Menyimpan…"
          : cancelled
            ? "Pulihkan milestone"
            : "Batalkan milestone"}
      </button>
      <p className="muted">
        {cancelled
          ? "Dibatalkan; tidak dihitung di Agenda atau deadline agent. Pulihkan untuk mengaktifkannya kembali."
          : "Pembatalan menyimpan riwayat dan dapat dipulihkan; tidak menghapus milestone."}{" "}
        Google Calendar belum terhubung.
      </p>
      {error && (
        <div role="alert">
          <p className="error">{error}</p>
          <button
            type="button"
            className="secondary"
            onClick={() => router.refresh()}
          >
            Muat ulang milestone
          </button>
        </div>
      )}
    </div>
  );
}
