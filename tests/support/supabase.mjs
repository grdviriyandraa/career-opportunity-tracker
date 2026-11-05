// Synthetic Supabase protocol fixture. Never deploy or use with production credentials.
import http from "node:http";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
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
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
);
await db.exec(
  await readFile("supabase/migrations/202611050001_core.sql", "utf8"),
);
await db.query("insert into auth.users values($1)", [owner]);
await db.query("insert into profiles(owner_id) values($1)", [owner]);
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
    if (req.headers.authorization !== "Bearer " + token)
      return response(res, 401, { message: "Invalid test session" });
    if (url.pathname === "/auth/v1/user") return response(res, 200, user);
    if (url.pathname === "/auth/v1/logout") return response(res, 200, {});
    if (url.pathname.startsWith("/rest/v1/")) {
      try {
        const result = await db.transaction(async (tx) => {
          await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
            owner,
          ]);
          await tx.exec("set local role authenticated");
          if (url.pathname.includes("/rpc/")) {
            const name = url.pathname.split("/").at(-1);
            const args = {
              capture_draft: ["p_payload", "p_key", "p_canonical"],
              update_opportunity: ["p_id", "p_patch"],
              add_milestone: ["p_id", "p_payload"],
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
            ].includes(table)
          )
            throw new Error("Table not supported");
          const values = [];
          const conditions = [];
          for (const key of [
            "id",
            "opportunity_id",
            "category",
            "archived_at",
            "created_at",
            "title",
          ]) {
            const filter = url.searchParams.get(key);
            if (!filter) continue;
            if (filter === "is.null") {
              conditions.push(key + " is null");
              continue;
            }
            if (filter === "not.is.null") {
              conditions.push(key + " is not null");
              continue;
            }
            const split = filter.indexOf(".");
            const op = { eq: "=", lt: "<", ilike: "ilike" }[
              filter.slice(0, split)
            ];
            if (!op) throw new Error("Unsupported filter");
            values.push(filter.slice(split + 1));
            conditions.push(key + " " + op + " $" + values.length);
          }
          const order = (url.searchParams.get("order") ?? "")
            .split(",")
            .filter(Boolean)
            .map((o) => {
              const [col, dir, nulls] = o.split(".");
              if (!["created_at", "id", "date", "start_at"].includes(col))
                throw new Error("Unsupported order");
              return (
                col +
                " " +
                (dir === "desc" ? "desc" : "asc") +
                (nulls === "nullslast" ? " nulls last" : "")
              );
            });
          const columns = url.searchParams.get("select") ?? "*";
          if (!["*", "id,operation,created_at"].includes(columns))
            throw new Error("Unsupported columns");
          const limit = Math.min(
            200,
            Number(url.searchParams.get("limit") ?? 50),
          );
          const rows = (
            await tx.query(
              `select to_jsonb(row_data) as result from (select ${columns} from public.${table}${conditions.length ? " where " + conditions.join(" and ") : ""}${order.length ? " order by " + order.join(",") : ""} limit ${limit}) row_data`,
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
