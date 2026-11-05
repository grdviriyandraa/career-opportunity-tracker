"use client";
import { useState } from "react";
import {
  agentScopes,
  grantMetadata,
  type GrantMetadata,
} from "@/lib/agent-credentials";
import { z } from "zod";

export function AgentSettings({
  initialItems,
}: {
  initialItems: GrantMetadata[] | null;
}) {
  const [items, setItems] = useState<GrantMetadata[]>(initialItems ?? []);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState(
    initialItems
      ? ""
      : "Pengelolaan credential belum tersedia. Pastikan migrasi agent diterapkan.",
  );
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(initialItems !== null);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  async function reload(signal?: AbortSignal) {
    const res = await fetch("/api/integrations/hermes", {
      cache: "no-store",
      signal,
    });
    if (!res.ok)
      throw new Error(
        "Pengelolaan credential belum dapat dimuat. Pastikan migrasi agent diterapkan.",
      );
    setItems(
      z.object({ items: z.array(grantMetadata) }).parse(await res.json()).items,
    );
    setLoaded(true);
    setCheckedAt(Date.now());
  }
  return (
    <section className="card" aria-labelledby="hermes-title">
      <h2 id="hermes-title">Hermes — credential baca dan draft</h2>
      <p>
        Credential hanya mengizinkan scope terpilih. Bot Windows/Telegram belum
        diuji; credential aktif tidak berarti bot online. Tidak ada akses
        coding, progres atau Google.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await reload();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Muat ulang credential
      </button>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setSecret("");
          const form = e.currentTarget;
          const data = new FormData(form);
          try {
            const res = await fetch("/api/integrations/hermes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                label: data.get("label"),
                expires_in_days: Number(data.get("days")),
                scopes: data.getAll("scopes"),
              }),
            });
            const result = await res.json();
            if (!res.ok)
              throw new Error(result.message ?? "Credential gagal dibuat.");
            setSecret(
              z
                .string()
                .regex(/^[A-Za-z0-9_-]{43}$/)
                .parse(result.token),
            );
            await reload();
            form.reset();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Label credential
          <input
            name="label"
            required
            maxLength={80}
            placeholder="Hermes laptop"
          />
        </label>
        <label>
          Masa berlaku (hari)
          <input
            name="days"
            type="number"
            min={1}
            max={30}
            defaultValue={30}
            required
          />
        </label>
        <fieldset>
          <legend>Izin credential</legend>
          {agentScopes.map((scope) => (
            <label key={scope}>
              <input
                type="checkbox"
                name="scopes"
                value={scope}
                defaultChecked
              />
              {scope}
            </label>
          ))}
        </fieldset>
        <p>
          Maksimal 10 credential aktif. Batas: 30 pembacaan dan 10 draft per
          menit per credential.
        </p>
        <button disabled={busy || !loaded}>Buat credential</button>
      </form>
      {secret && (
        <div role="status">
          <p>
            Simpan sekarang ke file credential privat di luar repository. Token
            hanya ditampilkan pada hasil pembuatan ini. Jangan kirim ke chat,
            prompt atau YAML.
          </p>
          <label>
            Token sekali tampil
            <input readOnly type="password" value={secret} autoComplete="off" />
          </label>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(secret);
              } catch {
                setError(
                  "Clipboard tidak tersedia. Pilih dan salin token dari kolom credential.",
                );
              }
            }}
          >
            Salin token
          </button>{" "}
          <button
            type="button"
            className="secondary"
            onClick={() => setSecret("")}
          >
            Sembunyikan token
          </button>
        </div>
      )}
      {loaded && !items.length && <p>Belum ada credential.</p>}
      {items.map((item) => (
        <div className="agenda-row" key={item.id}>
          <div>
            <h3>{item.label}</h3>
            <p>
              Prefix: {item.prefix}… · {item.scopes.join(", ")}
            </p>
            <p>
              {item.revoked_at
                ? "Dicabut"
                : Date.parse(item.expires_at) <= checkedAt
                  ? "Kedaluwarsa"
                  : "Aktif saat daftar dimuat"}{" "}
              · Berlaku sampai{" "}
              {new Date(item.expires_at).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
              })}{" "}
              (Asia/Jakarta)
            </p>
            <p>
              Terakhir dipakai:{" "}
              {item.last_used_at
                ? new Date(item.last_used_at).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })
                : "Belum ada penggunaan berhasil"}
            </p>
          </div>
          {!item.revoked_at && (
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                setSecret("");
                try {
                  const res = await fetch(
                    "/api/integrations/hermes/" + item.id,
                    { method: "DELETE" },
                  );
                  if (!res.ok)
                    throw new Error("Credential belum dapat dicabut.");
                  await reload();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Cabut {item.label}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
