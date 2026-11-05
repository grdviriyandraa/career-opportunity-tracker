import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { inputs, outputs } from "../tools/tracker-mcp/schemas";
import { configuration } from "./config";
import { canonicalUrl } from "./domain";
import { body, dbError, HttpError, respond } from "./server";
import {
  agentQuery,
  cursorFilter,
  decodeAgentCursor,
  encodeAgentCursor,
} from "./agent-protocol";

function bearer(req: Request) {
  const match = req.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  if (!match || /^sb_/.test(match[1]))
    throw new HttpError(
      401,
      "CREDENTIAL_REJECTED",
      "Credential agent diperlukan.",
    );
  return match[1];
}
function agentDb() {
  const c = configuration();
  if (!c)
    throw new HttpError(
      503,
      "SETUP_REQUIRED",
      "Konfigurasi aplikasi belum lengkap.",
    );
  // A fresh anonymous client: website cookies and Supabase user JWTs never enter this channel.
  return createClient(
    c.NEXT_PUBLIC_SUPABASE_URL,
    c.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
function agentError(error: { code?: string; message?: string } | null) {
  if (error?.code === "28000")
    throw new HttpError(
      401,
      "CREDENTIAL_REJECTED",
      "Credential kedaluwarsa, dicabut, atau tidak valid.",
    );
  if (error?.code === "42501")
    throw new HttpError(
      403,
      "SCOPE_DENIED",
      "Scope credential tidak mengizinkan tindakan ini.",
    );
  if (error?.code === "PT429")
    throw new HttpError(
      429,
      "RATE_LIMITED",
      "Batas permintaan tercapai. Coba kembali dalam satu menit.",
    );
  dbError(error);
}
function appUrl(id: string) {
  return new URL(
    "/opportunities/" + z.uuid().parse(id),
    configuration()!.APP_URL,
  ).href;
}
type Operation =
  | "search_opportunities"
  | "get_opportunity"
  | "get_upcoming_deadlines"
  | "create_draft";
function input<T>(fn: () => T): T {
  try {
    return fn();
  } catch {
    throw new HttpError(400, "INVALID_INPUT", "Input atau cursor tidak valid.");
  }
}
export async function agentResponse(
  req: Request,
  operation: Operation,
  id?: string,
) {
  const response = await respond(async () => {
    const token = bearer(req);
    const db = agentDb();
    if (operation === "create_draft") {
      const raw = await body(req);
      const payload = input(() => inputs.create_draft.parse(raw));
      const key = input(() =>
        z.uuid().parse(req.headers.get("idempotency-key")),
      );
      const { data, error } = await db.rpc("agent_capture", {
        p_token: token,
        p_payload: payload,
        p_key: key,
        p_canonical: payload.source_url
          ? canonicalUrl(payload.source_url)
          : null,
      });
      agentError(error);
      const result = outputs.create_draft.parse({
        ...data.receipt,
        app_url: appUrl(data.receipt.opportunity_id),
      });
      return Response.json(result, {
        status: data.replayed || result.outcome !== "created" ? 200 : 201,
      });
    }
    const parsed = input(() =>
      operation === "get_opportunity"
        ? inputs.get_opportunity.parse({ opportunity_id: id })
        : agentQuery(new URL(req.url), operation),
    );
    if (operation === "get_opportunity" && new URL(req.url).search)
      throw new HttpError(400, "INVALID_INPUT", "Query tidak diizinkan.");
    const { cursor, ...filters } =
      "cursor" in parsed ? parsed : { ...parsed, cursor: undefined };
    const digest = cursorFilter(operation, filters);
    const after = input(() => decodeAgentCursor(cursor, digest));
    const { data, error } = await db.rpc("agent_read", {
      p_token: token,
      p_operation: operation,
      p_args: { ...filters, after },
    });
    agentError(error);
    const decorate = (item: Record<string, unknown>) => ({
      ...item,
      app_url: appUrl(String(item.opportunity_id ?? item.id)),
    });
    const envelope = {
      schema_version: 1,
      request_id: crypto.randomUUID(),
      data_as_of: new Date().toISOString(),
      timezone: "Asia/Jakarta",
      next_cursor: data.after ? encodeAgentCursor(data.after, digest) : null,
      warnings:
        operation === "get_upcoming_deadlines"
          ? [
              "Hanya deadline internal; kalender pribadi dan konflik belum diperiksa.",
            ]
          : ["Data tersimpan; waktu permintaan bukan verifikasi ulang sumber."],
      partial: false,
    };
    if (operation === "get_opportunity") {
      if (!data.item)
        throw new HttpError(404, "NOT_FOUND", "Peluang tidak ditemukan.");
      return Response.json(
        outputs.get_opportunity.parse({
          ...envelope,
          item: decorate(data.item),
        }),
      );
    }
    return Response.json(
      outputs[operation].parse({
        ...envelope,
        items: data.items.map(decorate),
      }),
    );
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Authorization");
  if (response.status === 429) response.headers.set("Retry-After", "60");
  // Include only validated, bounded responses in the model context.
  if (Buffer.byteLength(await response.clone().text()) > 65536)
    return Response.json(
      { code: "RESPONSE_TOO_LARGE", retryable: false },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  return response;
}
