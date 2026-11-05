import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
import { BridgeError } from "./config.js";
export function payloadHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
export class IntentLedger {
  private db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(
      "pragma journal_mode=delete; pragma synchronous=full; pragma busy_timeout=5000; create table if not exists pending_intents(payload_hash text primary key, intent_key text not null unique, created_at text not null)",
    );
  }
  intent(hash: string) {
    this.db.exec("begin immediate");
    try {
      const old = this.db
        .prepare("select intent_key from pending_intents where payload_hash=?")
        .get(hash);
      if (old) {
        this.db.exec("commit");
        return String(old.intent_key);
      }
      const count = this.db
        .prepare("select count(*) as n from pending_intents")
        .get()!;
      if (Number(count.n) >= 1000) throw new BridgeError("LEDGER_FULL");
      const key = randomUUID();
      this.db
        .prepare("insert into pending_intents values(?,?,?)")
        .run(hash, key, new Date().toISOString());
      this.db.exec("commit");
      return key;
    } catch (e) {
      this.db.exec("rollback");
      throw e;
    }
  }
  complete(hash: string, key: string) {
    this.db
      .prepare(
        "delete from pending_intents where payload_hash=? and intent_key=?",
      )
      .run(hash, key);
  }
  close() {
    this.db.close();
  }
}
