// Synthetic Supabase protocol fixture. Never deploy or use with production credentials.
import http from "node:http";
import crypto from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const owner = "00000000-0000-4000-8000-000000000001";
const user = {
  id: owner,
  aud: "authenticated",
  role: "authenticated",
  email: "owner@example.test",
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
);
for (const file of (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
}
await db.query("insert into auth.users values($1)", [owner]);
await db.query("insert into profiles(owner_id) values($1)", [owner]);
// Recreate only the two synthetic existing identities for history UAT; never real tracker data.
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
const researchFixture = JSON.parse(
  await readFile("examples/research_history.synthetic.json", "utf8"),
);
for (const [
  index,
  record,
] of researchFixture.initial_personal_records.entries()) {
  const item = researchFixture.runs[0].items.find(
    (i) => i.external_id === record.external_id,
  );
  const result = await db.query(
    "select public.capture_draft($1,$2,$3) result",
    [
      { title: "Owner title " + index, source_url: item.evidence_url },
      "10000000-0000-4000-8000-00000000000" + (index + 1),
      item.evidence_url,
    ],
  );
  await db.query(
    "insert into research_identities(owner_id,source_system,external_id,opportunity_id,first_seen_at,source_checked_at,public_snapshot) values($1,$2,$3,$4,$5,null,$6)",
    [
      owner,
      "synthetic_research_history",
      record.external_id,
      result.rows[0].result.opportunity_id,
      record.first_seen_at,
      {},
    ],
  );
}
for (const source of [
  "synthetic_research_history_desktop",
  "synthetic_research_history_mobile",
]) {
  await db.query(
    "insert into research_identities(owner_id,source_system,external_id,opportunity_id,first_seen_at,source_checked_at,public_snapshot) select owner_id,$1,external_id,opportunity_id,first_seen_at,source_checked_at,public_snapshot from research_identities where source_system=$2",
    [source, "synthetic_research_history"],
  );
}
// Volume fixture: archived synthetic parent, 4,998 old dates and two future
// overlapping events whose IDs sort after the first 1,000 milestones.
await db.query(
  "insert into opportunities(id,owner_id,title,archived_at,created_at) values($1,$2,'Synthetic volume fixture','2025-01-01','2025-01-01')",
  ["00000000-0000-4000-8000-000000005000", owner],
);
await db.query(
  `insert into milestones(id,owner_id,opportunity_id,title,kind,precision,date,start_at,end_at,timezone,attendance)
   select ('fffffffe-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,$1,'00000000-0000-4000-8000-000000005000'::uuid,
   'Synthetic volume ' || i,
   case when i<=4998 then 'deadline' else 'event' end,
   case when i<=4998 then 'date' else 'instant' end,
   case when i<=4998 then '2024-01-01'::date else null end,
   case when i>4998 then '2030-05-15T10:00:00+07:00'::timestamptz else null end,
   case when i>4998 then '2030-05-15T11:00:00+07:00'::timestamptz else null end,
   'Asia/Jakarta',case when i<=4998 then 'unknown' else 'confirmed' end
   from generate_series(1,5000) i`,
  [owner],
);
// Export acceptance: long history and an inactive milestone must remain downloadable.
await db.query(
  `insert into change_history(id,owner_id,opportunity_id,operation,before_value,after_value)
   select ('fffffff0-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,$1,
   '00000000-0000-4000-8000-000000005000'::uuid,'synthetic_export_history',
   jsonb_build_object('notes','before ' || i),jsonb_build_object('notes','after ' || i)
   from generate_series(1,355) i`,
  [owner],
);
await db.query(
  `insert into milestones(id,owner_id,opportunity_id,title,kind,precision,date,timezone,attendance,cancelled_at)
   values('fffffffe-0000-4000-8000-000000005001',$1,'00000000-0000-4000-8000-000000005000',
   'Synthetic cancelled export milestone','deadline','date','2024-01-01','Asia/Jakarta','unknown','2025-01-01')`,
  [owner],
);
const encode = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const header = encode({ alg: "HS256", typ: "JWT" }),
  payload = encode({
    sub: owner,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  });
const token =
  header +
  "." +
  payload +
  "." +
  crypto
    .createHmac("sha256", "synthetic-test-only")
    .update(header + "." + payload)
    .digest("base64url");
function response(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:54329");
    let raw = "";
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    if (url.pathname === "/health") return response(res, 200, { ok: true });
    if (url.pathname === "/auth/v1/otp") return response(res, 200, {});
    if (url.pathname === "/auth/v1/verify") {
      if (body.email !== user.email || body.token !== "123456")
        return response(res, 400, { msg: "Invalid OTP" });
      return response(res, 200, {
        access_token: token,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "synthetic-refresh",
        user,
      });
    }
    const agentRpc =
      ["/rest/v1/rpc/agent_read", "/rest/v1/rpc/agent_capture"].includes(
        url.pathname,
      ) && req.headers.authorization === "Bearer synthetic-publishable-key";
    if (!agentRpc && req.headers.authorization !== "Bearer " + token)
      return response(res, 401, { message: "Invalid test session" });
    if (url.pathname === "/auth/v1/user") return response(res, 200, user);
    if (url.pathname === "/auth/v1/logout") return response(res, 200, {});
    if (url.pathname.startsWith("/rest/v1/")) {
      try {
        const result = await db.transaction(async (tx) => {
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
            agentRpc ? "" : owner,
          ]);
          await tx.exec(
            agentRpc ? "set local role anon" : "set local role authenticated",
          );
          if (url.pathname.includes("/rpc/")) {
            const name = url.pathname.split("/").at(-1);
            const args = {
              list_agent_grants: [],
              mint_agent_grant: ["p_token", "p_label", "p_scopes", "p_days"],
              revoke_agent_grant: ["p_id"],
              agent_read: ["p_token", "p_operation", "p_args"],
              agent_capture: ["p_token", "p_payload", "p_key", "p_canonical"],
              resolve_research_proposal: [
                "p_id",
                "p_expected",
                "p_action",
                "p_fields",
              ],
              prepare_research: ["p_batch"],
              apply_research: ["p_preview", "p_hash"],
              capture_draft: ["p_payload", "p_key", "p_canonical"],
              update_opportunity: ["p_id", "p_patch"],
              add_milestone: ["p_id", "p_payload"],
              update_milestone: ["p_id", "p_milestone", "p_patch"],
            }[name];
            if (!args) throw new Error("RPC not supported");
            return (
              await tx.query(
                `select to_jsonb(public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")})) result`,
                args.map((k) => body[k] ?? null),
              )
            ).rows[0].result;
          }
          const table = url.pathname.split("/").at(-1);
          if (
            ![
              "opportunities",
              "milestones",
              "change_history",
              "profiles",
              "research_runs",
              "research_identities",
              "research_items",
              "research_corrections",
              "research_proposals",
            ].includes(table)
          )
            throw new Error("Table not supported");
          const values = [];
          const conditions = [];
          for (const key of [
            "owner_id",
            "id",
            "opportunity_id",
            "category",
            "archived_at",
            "cancelled_at",
            "created_at",
            "title",
            "research_run_id",
            "source_system",
            "status",
          ]) {
            // PostgREST combines repeated filters on the same column with AND.
            for (const filter of url.searchParams.getAll(key)) {
              if (filter === "is.null") {
                conditions.push(key + " is null");
                continue;
              }
              if (filter === "not.is.null") {
                conditions.push(key + " is not null");
                continue;
              }
              const split = filter.indexOf(".");
              const op = { eq: "=", lt: "<", gt: ">", ilike: "ilike" }[
                filter.slice(0, split)
              ];
              if (!op) throw new Error("Unsupported filter");
              values.push(filter.slice(split + 1));
              conditions.push(key + " " + op + " $" + values.length);
            }
          }
          const order = (url.searchParams.get("order") ?? "")
            .split(",")
            .filter(Boolean)
            .map((o) => {
              const [col, dir, nulls] = o.split(".");
              if (
                ![
                  "created_at",
                  "id",
                  "date",
                  "start_at",
                  "imported_at",
                  "external_id",
                  "source_system",
                  "owner_id",
                ].includes(col)
              )
                throw new Error("Unsupported order");
              return (
                col +
                " " +
                (dir === "desc" ? "desc" : "asc") +
                (nulls === "nullslast" ? " nulls last" : "")
              );
            });
          const columns = url.searchParams.get("select") ?? "*";
          if (columns !== "*" && !/^[a-z_]+(,[a-z_]+)*$/.test(columns))
            throw new Error("Unsupported columns");
          if (req.headers.prefer?.includes("count=exact")) {
            const total = (
              await tx.query(
                `select count(*)::int as total from public.${table}${conditions.length ? " where " + conditions.join(" and ") : ""}`,
                values,
              )
            ).rows[0].total;
            res.setHeader("Content-Range", "*/" + total);
          }
          if (req.method === "HEAD") return null;
          const limit = Math.min(
            1000,
            Number(url.searchParams.get("limit") ?? 50),
          );
          const rows = (
            await tx.query(
              `select to_jsonb(row_data) as result from (select ${columns} from public.${table}${conditions.length ? " where " + conditions.join(" and ") : ""}${order.length ? " order by " + order.join(",") : ""} limit ${limit} offset ${Math.max(0, Number(url.searchParams.get("offset") ?? 0))}) row_data`,
              values,
            )
          ).rows.map((row) => row.result);
          return req.headers.accept?.includes("vnd.pgrst.object")
            ? (rows[0] ?? null)
            : rows;
        });
        return response(res, 200, result);
      } catch (e) {
        return response(res, 400, {
          code: e.code ?? "FIXTURE_ERROR",
          message: "Synthetic DB request failed",
        });
      }
    }
    return response(res, 404, { message: "Unknown fixture route" });
  } catch {
    return response(res, 500, { message: "Synthetic provider failure" });
  }
});
server.listen(54329, "127.0.0.1", () =>
  process.stdout.write("Synthetic Supabase fixture ready\n"),
);
