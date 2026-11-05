import type { Milestone, Opportunity } from "./domain";
import type { ResearchRun, ResearchItem, ResearchResult } from "./research";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
type OpportunityRow = Opportunity & {
  owner_id: string;
  canonical_url: string | null;
};
type MilestoneRow = Milestone & { owner_id: string; revision: number };
type HistoryRow = {
  id: string;
  owner_id: string;
  opportunity_id: string;
  actor: string;
  operation: string;
  before_value: Json | null;
  after_value: Json | null;
  created_at: string;
};
type ReadOnlyTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};
export type CaptureReceipt = {
  outcome: "created" | "existing";
  opportunity_id: string;
  revision: number;
  saved_at: string;
  extraction_status: "manual_required";
};
// Keep synchronized with the migration. Direct client writes intentionally have no type.
export type Database = {
  public: {
    Tables: {
      research_runs: ReadOnlyTable<ResearchRun & { owner_id: string }>;
      research_items: ReadOnlyTable<ResearchItem & { owner_id: string }>;
      research_corrections: ReadOnlyTable<{
        id: string;
        owner_id: string;
        research_run_id: string;
        payload_hash: string;
        proposed_summary: Json;
        status: string;
        created_at: string;
      }>;
      research_proposals: ReadOnlyTable<{
        id: string;
        owner_id: string;
        research_run_id: string;
        opportunity_id: string;
        expected_revision: number;
        proposed_public_snapshot: Json;
        base_public_snapshot: Json;
        receipt: Json | null;
        status: string;
      }>;
      profiles: ReadOnlyTable<{
        owner_id: string;
        timezone: string;
        max_work_hours: number;
        total_capacity: number | null;
        singleton: boolean;
      }>;
      opportunities: ReadOnlyTable<OpportunityRow>;
      milestones: ReadOnlyTable<MilestoneRow>;
      change_history: ReadOnlyTable<HistoryRow>;
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Functions: {
      resolve_research_proposal: {
        Args: {
          p_id: string;
          p_expected: number;
          p_action: string;
          p_fields: string[];
        };
        Returns: Json;
      };
      prepare_research: { Args: { p_batch: Json }; Returns: ResearchResult };
      apply_research: {
        Args: { p_preview: string; p_hash: string };
        Returns: ResearchResult;
      };
      capture_draft: {
        Args: { p_payload: Json; p_key: string; p_canonical?: string | null };
        Returns: CaptureReceipt;
      };
      update_opportunity: {
        Args: { p_id: string; p_patch: Json };
        Returns: OpportunityRow;
      };
      add_milestone: {
        Args: { p_id: string; p_payload: Json };
        Returns: MilestoneRow;
      };
    };
  };
};
