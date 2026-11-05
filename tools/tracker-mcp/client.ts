import { setTimeout as delay } from "node:timers/promises";
import { BridgeError, readToken, type BridgeConfig } from "./config.js";
import { IntentLedger, payloadHash } from "./ledger.js";
import { inputs, outputs, type ToolName } from "./schemas.js";
const MAX_BYTES = 65536;
export class TrackerClient {
  private inFlight = new Map<string, Promise<unknown>>();
  private shutdown = new AbortController();
  close() {
    this.shutdown.abort();
  }
  constructor(
    private config: BridgeConfig,
    private ledger: IntentLedger,
    private options: {
      timeoutMs?: number;
      sleep?: (ms: number) => Promise<unknown>;
    } = {},
  ) {}
  async call(name: ToolName, raw: unknown): Promise<unknown> {
    if (this.shutdown.signal.aborted) throw new BridgeError("BRIDGE_CLOSED");
    const parsed = inputs[name].safeParse(raw);
    if (!parsed.success) throw new BridgeError("INVALID_INPUT");
    const payload = parsed.data;
    if (Buffer.byteLength(JSON.stringify(payload)) > MAX_BYTES)
      throw new BridgeError("INVALID_INPUT");
    if (name === "create_draft") {
      const hash = payloadHash(payload);
      const active = this.inFlight.get(hash);
      if (active) return active;
      const work = this.capture(hash, payload);
      this.inFlight.set(hash, work);
      try {
        return await work;
      } finally {
        this.inFlight.delete(hash);
      }
    }
    return this.request(name, payload);
  }
  private async capture(hash: string, payload: object) {
    const key = this.ledger.intent(hash);
    const receipt = await this.request("create_draft", payload, key);
    this.ledger.complete(hash, key);
    return receipt;
  }
  private async request(
    name: ToolName,
    payload: object,
    key?: string,
  ): Promise<unknown> {
    const url = new URL(this.config.origin);
    const args = payload as Record<string, unknown>;
    url.pathname =
      name === "create_draft"
        ? "/api/agent/drafts"
        : name === "get_upcoming_deadlines"
          ? "/api/agent/deadlines"
          : name === "get_opportunity"
            ? "/api/agent/opportunities/" + args.opportunity_id
            : "/api/agent/opportunities";
    if (!key && name !== "get_opportunity")
      for (const [k, v] of Object.entries(args))
        url.searchParams.set(k, String(v));
    for (let attempt = 0; attempt < 3; attempt++) {
      let retryAfter = 0;
      try {
        const token = await readToken(this.config.tokenFile);
        const response = await fetch(url, {
          method: key ? "POST" : "GET",
          redirect: "manual",
          signal: AbortSignal.any([
            this.shutdown.signal,
            AbortSignal.timeout(this.options.timeoutMs ?? 15000),
          ]),
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json",
            ...(key
              ? { "Content-Type": "application/json", "Idempotency-Key": key }
              : {}),
          },
          ...(key ? { body: JSON.stringify(payload) } : {}),
        });
        if (response.status === 429 || response.status >= 500) {
          const retry = response.headers.get("retry-after");
          retryAfter = retry
            ? /^\d+$/.test(retry)
              ? Number(retry) * 1000
              : Math.max(0, Date.parse(retry) - Date.now())
            : 0;
          await response.body?.cancel();
          if (!Number.isFinite(retryAfter) || retryAfter > 30000)
            throw new BridgeError("BACKEND_BUSY", false);
          throw new BridgeError("BACKEND_UNAVAILABLE", true);
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new BridgeError(
            response.status === 401 || response.status === 403
              ? "CREDENTIAL_REJECTED"
              : response.status === 409
                ? "RECONCILIATION_REQUIRED"
                : response.status >= 300 && response.status < 400
                  ? "REDIRECT_DENIED"
                  : "BACKEND_REJECTED",
          );
        }
        if (!response.headers.get("content-type")?.includes("application/json"))
          throw new BridgeError("INVALID_BACKEND_RESPONSE");
        const declared = Number(response.headers.get("content-length") ?? "0");
        if (declared > MAX_BYTES) {
          await response.body?.cancel();
          throw new BridgeError("RESPONSE_TOO_LARGE");
        }
        const reader = response.body?.getReader();
        if (!reader) throw new BridgeError("INVALID_BACKEND_RESPONSE");
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > MAX_BYTES) {
            await reader.cancel();
            throw new BridgeError("RESPONSE_TOO_LARGE");
          }
          chunks.push(part.value);
        }
        let decoded: unknown;
        try {
          decoded = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          throw new BridgeError("INVALID_BACKEND_RESPONSE");
        }
        const projected = outputs[name].safeParse(decoded);
        if (!projected.success)
          throw new BridgeError("INVALID_BACKEND_RESPONSE");
        const data = projected.data;
        const items =
          "items" in data ? data.items : "item" in data ? [data.item] : [data];
        for (const item of items) {
          const app = new URL(item.app_url);
          const recordId =
            "opportunity_id" in item
              ? item.opportunity_id
              : "id" in item
                ? item.id
                : "";
          if (
            app.origin !== this.config.origin ||
            app.pathname !== "/opportunities/" + recordId ||
            app.search ||
            app.hash ||
            app.username ||
            app.password
          )
            throw new BridgeError("INVALID_BACKEND_RESPONSE");
        }
        if (JSON.stringify(data).includes(token))
          throw new BridgeError("INVALID_BACKEND_RESPONSE");
        return data;
      } catch (error) {
        const safe = this.shutdown.signal.aborted
          ? new BridgeError("BRIDGE_CLOSED")
          : error instanceof BridgeError
            ? error
            : new BridgeError("BACKEND_UNAVAILABLE", true);
        if (!safe.retryable || attempt === 2) throw safe;
        const ms = Math.max(
          retryAfter,
          250 * 2 ** attempt + Math.floor(Math.random() * 100),
        );
        try {
          if (this.options.sleep) await this.options.sleep(ms);
          else await delay(ms, undefined, { signal: this.shutdown.signal });
        } catch {
          throw new BridgeError("BRIDGE_CLOSED");
        }
      }
    }
    throw new BridgeError("BACKEND_UNAVAILABLE", true);
  }
}
