"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResearchResult } from "@/lib/research";
async function post(url: string, data: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message ?? "Impor gagal.");
  return result as ResearchResult;
}
export function ResearchImport() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <details className="card import-panel">
      <summary>Impor snapshot riset (JSON)</summary>
      <p className="muted">
        Impor manual melalui preview. Koneksi Google Sheets belum aktif. Hanya
        fakta sumber publik yang diterima; catatan pribadi, kontak dan progres
        tidak boleh dimasukkan.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setResult(null);
          try {
            let payload;
            try {
              payload = JSON.parse(text);
            } catch {
              throw new Error("JSON tidak valid. Periksa format file.");
            }
            setResult(await post("/api/research/previews", payload));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          File snapshot JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              setResult(null);
              setError("");
              if (!file) return;
              if (file.size > 524288) {
                setError("Maksimal 512 KiB.");
                return;
              }
              setText(await file.text());
            }}
          />
        </label>
        <label>
          Payload snapshot riset
          <textarea
            rows={7}
            maxLength={524288}
            value={text}
            required
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
              setError("");
            }}
            spellCheck={false}
          />
        </label>
        <p className="muted">
          Format schema_version 1 dijelaskan dalam docs/RESEARCH_IMPORT.md.
          Preview berlaku 15 menit; perubahan data setelah preview memerlukan
          review ulang.
        </p>
        <button className="secondary" disabled={busy}>
          {busy ? "Memproses…" : "Buat preview impor"}
        </button>
      </form>
      <div aria-live="polite">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {result?.status === "preview" && (
          <section className="preview-result">
            <h3>Review sebelum menerapkan</h3>
            <p>
              Inventaris setelah impor:{" "}
              <strong>{result.inventory_total}</strong>. {result.new_count}{" "}
              baru, {result.enriched_count} lama diperiksa,{" "}
              {result.carry_forward} memakai hasil lama.
            </p>
            <p>
              Progres dan nilai yang sudah ada pada peluang tidak ditimpa.
              Perubahan fakta sumber akan menunggu review.
            </p>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const receipt = await post(
                    "/api/research/previews/" + result.preview_id + "/apply",
                    { payload_hash: result.payload_hash },
                  );
                  setResult(receipt);
                  router.push("/inbox?run=" + receipt.research_run_id);
                  router.refresh();
                } catch (e) {
                  setError((e as Error).message);
                  setResult(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Terapkan impor yang ditinjau
            </button>
          </section>
        )}
        {result?.status === "applied" && (
          <p className="success">
            Snapshot {result.run_id} tersimpan. {result.domain_created} peluang
            dibuat; {result.public_proposals} usulan menunggu review.
          </p>
        )}
        {result?.status === "replay" && (
          <p className="success">
            Run sudah pernah diimpor. Tidak ada perubahan domain tambahan.
          </p>
        )}
        {result?.status === "correction_required" && (
          <p className="error">
            Run ID sama memiliki payload berbeda. Versi koreksi disimpan untuk
            review; snapshot awal dan progres pribadi tetap utuh. Penerapan
            koreksi belum tersedia.
          </p>
        )}
      </div>
    </details>
  );
}
