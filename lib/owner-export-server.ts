import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { createOwnerExport, exportColumns } from "./owner-export";
import { dbError } from "./server";

export async function loadOwnerExport(
  db: SupabaseClient<Database>,
  ownerId: string,
) {
  const signal = AbortSignal.timeout(60_000);
  return createOwnerExport(
    {
      count: async (table) => {
        const result = await db
          .from(table)
          .select("owner_id", { count: "exact", head: true })
          .eq("owner_id", ownerId)
          .abortSignal(signal);
        dbError(result.error);
        return result.count;
      },
      page: async (table, { after, offset, limit }) => {
        const columns: string = exportColumns[table];
        let query = db.from(table).select(columns).eq("owner_id", ownerId);
        if (table === "research_identities") {
          // Composite text key uses database collation. Bounded ordered offset reads
          // avoid constructing PostgREST filter expressions from imported text.
          query = query
            .order("source_system")
            .order("external_id")
            .range(offset, offset + limit - 1);
        } else {
          const key = table === "profiles" ? "owner_id" : "id";
          query = query.order(key).limit(limit);
          if (after) query = query.gt(key, after);
        }
        const result = await query.abortSignal(signal);
        dbError(result.error);
        return (result.data ?? []) as unknown as Record<string, unknown>[];
      },
    },
    ownerId,
  );
}
