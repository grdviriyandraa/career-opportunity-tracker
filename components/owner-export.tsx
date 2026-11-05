"use client";
import { useRef, useState } from "react";

export function OwnerExport() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return (
    <section className="card">
      <h2>Ekspor data pribadi</h2>
      <p>
        Unduh JSON berisi peluang aktif dan arsip, milestone, seluruh riwayat
        perubahan, serta snapshot dan usulan riset.
      </p>
      <p className="muted">
        File memuat catatan dan teks sumber pribadi. Simpan di tempat aman.
        Hindari mengedit selama ekspor. Pembacaan bertahap ini belum menyediakan
        backup database atau pemulihan otomatis.
      </p>
      <button
        disabled={busy}
        onClick={async () => {
          if (inFlight.current) return;
          inFlight.current = true;
          setBusy(true);
          setDone(false);
          setError("");
          try {
            const response = await fetch("/api/export", { method: "POST" });
            if (!response.ok) {
              const result = await response.json();
              throw new Error(result.message ?? "Ekspor gagal. Coba lagi.");
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download =
              response.headers
                .get("Content-Disposition")
                ?.match(/filename="([^"]+)"/)?.[1] ?? "career-tracker.json";
            document.body.appendChild(link);
            link.click();
            link.remove();
            // Give the browser time to start reading the blob before releasing it.
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
            setDone(true);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Ekspor gagal. Coba lagi.",
            );
          } finally {
            inFlight.current = false;
            setBusy(false);
          }
        }}
      >
        {busy ? "Menyiapkan ekspor…" : "Unduh JSON pribadi"}
      </button>
      <div aria-live="polite">
        {busy && <p>Memeriksa kelengkapan data…</p>}
        {done && <p>File siap diunduh. Simpan salinannya dengan aman.</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
