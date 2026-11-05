"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Opportunity } from "@/lib/domain";
export type Proposal = {
  id: string;
  research_run_id: string;
  expected_revision: number;
  proposed_public_snapshot: unknown;
  base_public_snapshot: unknown;
};
function object(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
const fields = [
  "title",
  "organization",
  "eligibility",
  "posting_status",
] as const;
const labels = {
  title: "Judul",
  organization: "Organisasi",
  eligibility: "Kelayakan",
  posting_status: "Status posting",
};
export function ResearchReview({
  proposal,
  item,
}: {
  proposal: Proposal;
  item: Opportunity;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const next = object(proposal.proposed_public_snapshot),
    base = object(proposal.base_public_snapshot);
  const classification = String(next.classification ?? "");
  const eligibility: Record<string, string> = {
    confirmed: "eligible",
    conditional: "conditional",
    pending: "pending",
    ineligible: "ineligible",
  };
  const proposed: Record<string, unknown> = {
    title: next.title,
    organization: next.organization,
    eligibility: eligibility[classification] ?? null,
    posting_status: classification === "closed" ? "closed" : null,
  };
  async function resolve(action: "accept" | "dismiss") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/research/proposals/" + proposal.id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expected_revision: item.revision,
          action,
          fields: action === "accept" ? selected : [],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Review gagal.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card proposal-review">
      <span className="eyebrow">REVIEW FAKTA SUMBER</span>
      <h2>Usulan perubahan publik</h2>
      <p className="muted">
        Sumber diperiksa:{" "}
        {typeof next.source_checked_at === "string"
          ? next.source_checked_at
          : "Belum diketahui"}
        . Belum diverifikasi ulang saat halaman dibuka. Bandingkan nilai saat
        usulan dibuat, nilai sekarang, dan usulan. Progres, tanggal aktual,
        serta catatan pribadi tidak diubah.
      </p>
      <div className="review-fields">
        {fields.map((f) => {
          const value = proposed[f];
          const eligible =
            typeof value === "string" &&
            value.trim() !== "" &&
            value !== item[f];
          return (
            <label className="review-field" key={f}>
              <span className="inline">
                <input
                  type="checkbox"
                  disabled={!eligible || busy}
                  checked={selected.includes(f)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, f]
                        : selected.filter((v) => v !== f),
                    )
                  }
                />
                {labels[f]}
              </span>
              <small>
                Saat usulan dibuat:{" "}
                {base[f] === null || base[f] === undefined
                  ? "Belum diketahui"
                  : String(base[f])}
              </small>
              <small>
                Sekarang:{" "}
                {item[f] === null ? "Belum diketahui" : String(item[f])}
              </small>
              <strong>
                Usulan:{" "}
                {value === null || value === undefined
                  ? "Tidak ada fakta baru"
                  : String(value)}
              </strong>
            </label>
          );
        })}
      </div>
      <p className="muted">
        Hanya field yang dicentang akan diterapkan pada revisi {item.revision}.
        Nilai unknown tidak dapat menghapus nilai yang sudah tersimpan.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button
          disabled={busy || !selected.length}
          onClick={() => resolve("accept")}
        >
          Terapkan field terpilih
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => resolve("dismiss")}
        >
          Abaikan usulan ini
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => router.refresh()}
        >
          Muat ulang untuk review
        </button>
      </div>
    </section>
  );
}
