"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "./icons";
import {
  categories,
  categoryLabels,
  stageLabels,
  stages,
  type Opportunity,
} from "@/lib/domain";
async function send(
  url: string,
  payload: unknown,
  method = "POST",
  key?: string,
) {
  const r = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message ?? "Permintaan gagal.");
  return data;
}
function Feedback({ error, busy }: { error: string; busy: boolean }) {
  return (
    <div aria-live="polite">
      {busy && <p>Menyimpan…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="card narrow"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          await send("/api/auth/" + (sent ? "verify" : "login"), {
            email,
            ...(sent ? { token: f.get("token") } : {}),
          });
          if (sent) {
            router.refresh();
          } else setSent(true);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="eyebrow">RUANG PRIBADI</span>
      <h1>Masuk ke tracker</h1>
      <p>Gunakan email owner yang sudah didaftarkan.</p>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={sent}
        />
      </label>
      {sent && (
        <>
          <p>Periksa email untuk kode sekali pakai.</p>
          <label>
            Kode email
            <input
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
            />
          </label>
        </>
      )}
      <Feedback error={error} busy={busy} />
      <button disabled={busy}>
        {sent ? "Verifikasi dan masuk" : "Kirim kode masuk"}
      </button>
      {sent && (
        <button
          type="button"
          className="secondary"
          onClick={() => setSent(false)}
        >
          Ganti email / kirim ulang
        </button>
      )}
    </form>
  );
}
export function Logout() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="secondary"
        onClick={async () => {
          try {
            await send("/api/auth/logout", {});
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Keluar
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function Capture() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const intent = useRef<{ body: string; key: string } | null>(null);
  return (
    <form
      className="card capture"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        const raw = String(f.get("source") ?? "").trim();
        const category = String(f.get("category") ?? "");
        const payload = {
          ...(/^https?:\/\//i.test(raw)
            ? { source_url: raw }
            : { source_text: raw }),
          ...(f.get("title") ? { title: f.get("title") } : {}),
          ...(category ? { category } : {}),
        };
        const serialized = JSON.stringify(payload);
        if (intent.current?.body !== serialized)
          intent.current = { body: serialized, key: crypto.randomUUID() };
        try {
          const receipt = await send(
            "/api/opportunities/drafts",
            payload,
            "POST",
            intent.current.key,
          );
          intent.current = null;
          router.push("/opportunities/" + receipt.opportunity_id);
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <span className="eyebrow">TANGKAP SEKARANG, TINJAU NANTI</span>
        <h2>Simpan peluang</h2>
        <p>
          Satu link atau teks cukup. Draft disimpan tanpa menunggu ekstraksi.
        </p>
      </div>
      <label>
        Link, nama, atau teks sumber
        <textarea
          name="source"
          maxLength={20000}
          required
          rows={3}
          placeholder="Tempel link lowongan, program, atau kompetisi…"
        />
      </label>
      <div className="form-grid">
        <label>
          Judul (opsional)
          <input name="title" maxLength={300} />
        </label>
        <label>
          Kategori
          <select name="category">
            <option value="">Belum diklasifikasi</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabels[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Feedback error={error} busy={busy} />
      <button disabled={busy}>
        Simpan ke Inbox <ArrowUpRight />
      </button>
    </form>
  );
}
export function EditOpportunity({ item }: { item: Opportunity }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      key={item.revision}
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        const stage = String(f.get("personal_stage"));
        const payload = {
          expected_revision: item.revision,
          title: f.get("title"),
          organization: f.get("organization") || null,
          category: f.get("category") || null,
          personal_stage: stage,
          posting_status: f.get("posting_status"),
          eligibility: f.get("eligibility"),
          notes: f.get("notes"),
          employer_hours:
            f.get("employer_hours") === ""
              ? null
              : Number(f.get("employer_hours")),
          ...(stage === "applied" ? { actual_date: f.get("actual_date") } : {}),
          archived: f.get("archived") === "on",
        };
        try {
          await send("/api/opportunities/" + item.id, payload, "PATCH");
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Review & progres</h2>
      <div className="form-grid">
        <label>
          Judul
          <input
            name="title"
            required
            maxLength={300}
            defaultValue={item.title ?? ""}
          />
        </label>
        <label>
          Organisasi
          <input
            name="organization"
            maxLength={300}
            defaultValue={item.organization ?? ""}
          />
        </label>
        <label>
          Kategori
          <select name="category" defaultValue={item.category ?? ""}>
            <option value="">Belum diklasifikasi</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabels[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tahap pribadi
          <select name="personal_stage" defaultValue={item.personal_stage}>
            {stages.map((s) => (
              <option key={s} value={s}>
                {stageLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status posting
          <select name="posting_status" defaultValue={item.posting_status}>
            {[
              ["unknown", "Belum diketahui"],
              ["open", "Terbuka"],
              ["closed", "Ditutup"],
              ["expired", "Kedaluwarsa"],
            ].map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kelayakan
          <select name="eligibility" defaultValue={item.eligibility}>
            {[
              ["unknown", "Belum diketahui"],
              ["pending", "Perlu verifikasi"],
              ["eligible", "Memenuhi"],
              ["conditional", "Bersyarat"],
              ["ineligible", "Tidak memenuhi"],
            ].map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tanggal aktual melamar / mendaftar
          <input
            name="actual_date"
            type="date"
            defaultValue={item.actual_date ?? ""}
          />
          <small>Wajib saat memilih “Sudah melamar / mendaftar”.</small>
        </label>
        <label>
          Jam employer per minggu
          <input
            name="employer_hours"
            type="number"
            min={0}
            max={168}
            step="0.5"
            defaultValue={item.employer_hours ?? ""}
          />
          <small>Kosong berarti belum diketahui, bukan nol.</small>
        </label>
      </div>
      <label>
        Catatan pribadi
        <textarea
          name="notes"
          maxLength={20000}
          rows={4}
          defaultValue={item.notes}
        />
      </label>
      <label className="inline">
        <input
          name="archived"
          type="checkbox"
          defaultChecked={!!item.archived_at}
        />
        Arsipkan peluang
      </label>
      <p className="muted">
        Posting ditutup tidak berarti Anda ditolak. Membuka link apply tidak
        mengubah tahap pribadi.
      </p>
      <Feedback error={error} busy={busy} />
      <div className="actions">
        <button disabled={busy}>Simpan perubahan</button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setError("");
            router.refresh();
          }}
        >
          Muat ulang / tinjau revisi
        </button>
      </div>
    </form>
  );
}
export function AddMilestone({
  id,
  revision,
}: {
  id: string;
  revision: number;
}) {
  const router = useRouter();
  const [precision, setPrecision] = useState("date");
  const [kind, setKind] = useState("deadline");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        const f = new FormData(e.currentTarget);
        const payload = {
          expected_revision: revision,
          title: f.get("title"),
          kind,
          precision,
          timezone: f.get("timezone"),
          attendance: f.get("attendance"),
          ...(precision === "date"
            ? { date: f.get("date") }
            : {
                start_at: f.get("start_at"),
                ...(kind === "event" ? { end_at: f.get("end_at") } : {}),
              }),
        };
        try {
          await send("/api/opportunities/" + id + "/milestones", payload);
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Tambah milestone</h2>
      <label>
        Nama milestone
        <input name="title" required maxLength={300} />
      </label>
      <div className="form-grid">
        <label>
          Jenis
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="deadline">Deadline</option>
            <option value="event">Acara</option>
          </select>
        </label>
        <label>
          Presisi
          <select
            value={precision}
            onChange={(e) => setPrecision(e.target.value)}
          >
            <option value="date">Tanggal saja — jam belum diketahui</option>
            <option value="instant">Waktu pasti dengan offset</option>
          </select>
        </label>
        {precision === "date" ? (
          <label>
            Tanggal
            <input name="date" type="date" required />
          </label>
        ) : (
          <>
            <label>
              Mulai (ISO dengan offset)
              <input
                name="start_at"
                placeholder="2026-11-12T09:00:00+07:00"
                required
              />
            </label>
            {kind === "event" && (
              <label>
                Selesai (ISO dengan offset)
                <input
                  name="end_at"
                  placeholder="2026-11-12T10:00:00+07:00"
                  required
                />
              </label>
            )}
          </>
        )}
        <label>
          Zona sumber
          <input name="timezone" defaultValue="Asia/Jakarta" required />
        </label>
        <label>
          Partisipasi
          <select name="attendance">
            <option value="unknown">Belum diketahui</option>
            <option value="conditional">Bersyarat</option>
            <option value="confirmed">Terkonfirmasi</option>
          </select>
        </label>
      </div>
      <p className="muted">
        Tersimpan di agenda internal. Google Calendar belum terhubung.
      </p>
      <Feedback error={error} busy={busy} />
      <button disabled={busy}>Tambah milestone</button>
    </form>
  );
}
