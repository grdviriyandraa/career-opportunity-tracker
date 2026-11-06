# Implementation status

Baseline repository: `83161ffd53d4dda2099790f966332dc7cd3058e3` (historical handoff documents). Existing tracked documents were preserved. Imported archive: 57 SHA-256 entries verified; 40 missing files added. The archive is not an executable application.

## Current scope

Owner has deferred local-model, Hermes and Telegram work. Continue the website independently; those pilots are not prerequisites for the current website work. Existing optional agent/bridge code is retained.

WP00 audited; WP01–02, internal Agenda WP03, manual research/history WP05 and local agent/bridge WP06–07 subsets implemented. New standard Next.js application is separate from the legacy reference archive. Hosted migrations, confirmed Auth owner and singleton profile are now verified. G1 remains incomplete: signup is still enabled and OTP delivery/session verification plus authenticated website writes remain unverified. G2–G5 are not released. This is not the complete PRD or a production-ready tracker.

Resumed setup on 5 November 2026 from `feat/tracker-core` / `43fe734`: network diagnostic exit 0; MCP OAuth completed. After explicit owner approval and inspection of the empty database, applied both existing migrations and provisioned one confirmed owner profile. Hosted role simulation: owner sees one profile; another authenticated UUID sees zero. Restored ignored local app configuration without displaying credentials. Local website OTP request returned HTTP 200; delivery, numeric email template and code/session verification remain pending. No opportunity seed/import, main merge, push, deployment or environment publication. See latest release evidence for scope and advisor findings.

All four local migration filenames match hosted MCP history: 20261105143738_core.sql, 20261105143833_research.sql, 20261105154620_agent_api.sql and 20261105165019_milestone_lifecycle.sql. SQL hashes match the approved sources; do not replay them or their former filenames. Public signup closure and real owner-session acceptance remain pending. Latest local validation: lint/typecheck/website-MCP build, 127 tests and 22 browser cases passed; hosted schema/ACL/hash and negative Data API checks are separately recorded below.

| Work package | Status                           | Actual result / remaining work                                                                                                                                                                                                                                            |
| ------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WP00         | IMPLEMENTED_UNVERIFIED           | Baseline audit, ADR-001, dependency pins, lockfile, file map and privacy review. No hosted release.                                                                                                                                                                       |
| WP01         | PARTIAL_HOSTED (core subset)    | Hosted migrations and confirmed singleton owner profile verified; owner/other-user role simulation and grants inspected. OTP request accepted, delivery/session not verified; public signup remains enabled. Domain transactions remain tested locally; broad model, worker grants and rate limits incomplete. |
| WP02         | IN_PROGRESS                      | Seven menus, OTP form, capture/list/detail/progress/archive/search, exact URL dedup, revision conflict. Category-specific full forms, actions/undo entities, contacts/documents and extraction proposals remain.                                                          |
| WP03 | IN_PROGRESS | Paged internal Agenda, conflicts/buffers/deadline proximity and date/DST checks; local milestone edit/cancel/restore with dual revision guards, audit/outbox and active-only source/deadline counts. Lifecycle migration is applied hosted with schema/ACL/hash/negative Data API checks verified; owner-session behavior remains unverified. Recurrence/exceptions, workload/capacity, provider cleanup and reminders remain. |
| WP04         | NOT_STARTED                      | Google OAuth, Calendar/FreeBusy, encryption, worker/scheduler, retry/conflict resolution and legacy cutover.                                                                                                                                                              |
| WP05         | IN_PROGRESS                      | TESTED_MOCK subset: normalized JSON preview/apply, immutable R01–R04 snapshots, carry-forward, replay/correction quarantine, public field review, 300-row/rollback checks. Owner-only versioned JSON export of nine public app tables is implemented locally. Live Sheet/header parser, R05, correction acceptance, full recoverable export and backup remain. |
| WP06 | TESTED_LOCAL (core subset) | Four agent endpoints, Settings mint/list/revoke, scoped opaque tokens, expiry/revocation/account-status checks, SQL rate windows, safe projections and transactional receipts. Agent migration applied and schema/ACL/negative Data API checks verified; live credential/session acceptance pending; operational last-result audit/restore remain. |
| WP07 | TESTED_LOCAL (bridge + API) | Real stdio MCP SDK calls all four tools through implemented website routes and synthetic Supabase/PGlite; revoke and cross-channel denial verified. Windows/Hermes/Telegram and hosted transport remain unverified. |
| WP08 | DEFERRED by owner | Local model, Windows Hermes and Telegram are optional later work; no live pilot claimed. |
| WP09         | IN_PROGRESS (core checks only)   | Unit/database and browser harnesses. Full FR/INT/H/R acceptance not executed.                                                                                                                                                                                             |
| WP10         | IN_PROGRESS                      | Runnable README, ADR, CI definition and environment instructions; feature branch pushed; no production release or main merge.                                                                                                                                                                       |

## Validation evidence

See `docs/RELEASE_EVIDENCE.md` for actual commands, counts and limitations. GitHub Actions at commit `8a93dfa` was verified Success through the allowed public Actions page; the API hostname is still denied. Later changes require their own validation. Browser transport fixtures use synthetic Supabase responses and real PGlite PostgreSQL. They do not prove hosted Supabase or live email.

## Requirements traceability

PARTIAL means only the listed core behavior exists; it does not mean the full FR acceptance is passed. Requirements not listed as implemented remain NOT_STARTED. Existing private handoff data was not imported to the app database.

| FR   | Requirement                   | Status / implementation evidence                                                                          |
| ---- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| FR01 | Akun pribadi                  | PARTIAL — components/forms.tsx Login; lib/server.ts owner; hosted Auth BLOCKED                            |
| FR02 | Simpan cepat                  | PARTIAL — Capture, /api/opportunities/drafts; draft-before-fetch (fetch disabled)                         |
| FR03 | Form bertahap                 | PARTIAL — shared review form; full category conditional forms remain                                      |
| FR04 | Tindakan aktual               | PARTIAL — applied requires actual_date; separate action/undo entities remain                              |
| FR05 | Kelayakan dan status          | PARTIAL — independent personal_stage/posting_status/eligibility fields                                    |
| FR06 | Sumber dan koreksi            | PARTIAL — stored original URL/text; field evidence/proposals remain                                       |
| FR07 | Deduplikasi                   | PARTIAL — canonical URL uniqueness and transactional duplicate receipt; fuzzy/review remains              |
| FR08 | Arsip dan pencarian           | PARTIAL — paged title search, category lists, archive/restore                                             |
| FR09 | Milestone dinamis | PARTIAL — local add/edit/cancel/restore SQL/API/UI with parent + milestone revisions and before/after history; lifecycle schema/ACL verified hosted; real owner-session acceptance pending |
| FR10 | Presisi jadwal                | PARTIAL — DATE vs offset instant+IANA zone and DST day-boundary tests; recurrence wall-time resolution remains                   |
| FR11 | Bentrok interval              | PARTIAL — internal Agenda UI/API with coverage and confirmed/potential/buffer alerts; Google absent                                                |
| FR12 | Batas interval                | PARTIAL — half-open intervals, adjacency/buffer/overnight/window/DST tests; recurrence remains                                |
| FR13 | Deadline                      | PARTIAL — separate ≤48-hour proximity alerts; date-only potential, no invented duration                                                                                               |
| FR14 | Calendar terpilih             | NOT_STARTED                                                                                               |
| FR15 | Sync berulang                 | NOT_STARTED                                                                                               |
| FR16 | Kegagalan eksternal           | NOT_STARTED                                                                                               |
| FR17 | Perubahan remote              | NOT_STARTED                                                                                               |
| FR18 | Sesi berulang                 | NOT_STARTED                                                                                               |
| FR19 | Tahapan bersyarat             | PARTIAL — conditional attendance produces potential alerts; lifecycle handling remains                         |
| FR20 | Pengingat                     | NOT_STARTED                                                                                               |
| FR21 | Impor riset                   | PARTIAL — normalized JSON preview/apply and immutable run snapshots; live Sheet parser NOT_STARTED        |
| FR22 | Kepemilikan field             | PARTIAL — no personal overwrite; per-field public review + revision/RLS; live migration NOT_STARTED       |
| FR23 | Koreksi darurat               | NOT_STARTED                                                                                               |
| FR24 | Cutover                       | NOT_STARTED                                                                                               |
| FR25 | Restore                       | NOT_STARTED                                                                                               |
| FR26 | Unknown biaya                 | NOT_STARTED                                                                                               |
| FR27 | Sparse update                 | PARTIAL — sparse website update + public-only research proposals; replay and personal preservation tested |
| FR28 | Transaksi domain | PARTIAL — capture/update/milestone lifecycle + history/blocked outbox transactional; rollback tested locally, broader model remains |
| FR29 | Identitas URL                 | PARTIAL — canonical URL preserves job identity; database tests                                            |
| FR30 | Owner dan sesi                | PARTIAL — verified owner, RLS, no direct writes, Origin checks; hosted tests BLOCKED                      |
| FR31 | Identitas OAuth               | NOT_STARTED                                                                                               |
| FR32 | Antrean Calendar              | NOT_STARTED                                                                                               |
| FR33 | Cleanup agenda | PARTIAL — local milestone soft-cancel excludes internal/agent reads and queues blocked cleanup review; Google cleanup worker and hosted acceptance remain |
| FR34 | Resolusi remote               | NOT_STARTED                                                                                               |
| FR35 | Calendar legacy               | NOT_STARTED                                                                                               |
| FR36 | Mapping sumber                | NOT_STARTED                                                                                               |
| FR37 | Preview yang sah              | NOT_STARTED                                                                                               |
| FR38 | Ekspor lengkap | PARTIAL — owner-only JSON for all nine existing public app tables, paginated full history within explicit export budgets, counts/relationships/checksums; sequential reads, no restore, private operational state and future entities/files remain excluded. |
| FR39 | Scheduler nyata               | NOT_STARTED                                                                                               |
| FR40 | Konfigurasi jujur             | PARTIAL — setup/errors and truthful integration states; provider health remains                           |
| FR41 | Kesiapan GitHub               | PARTIAL — source/lockfile/CI/runbook and feature branch pushed; remote CI verified at 5d0e4a1, no release                                             |
| FR42 | Capture tahan gagal           | PARTIAL — committed manual draft independent of extraction; extractor NOT_STARTED                         |
| FR43 | Peran kanal | PARTIAL — bearer-only agent routes, cookie-only website/credential management; negative channel tests pass locally |
| FR44 | Akun Telegram                 | NOT_STARTED                                                                                               |
| FR45 | Jawaban berbasis data | PARTIAL — minimal read projection, unknown values and freshness warnings; model answers and full public evidence not tested |
| FR46 | Capture Telegram | PARTIAL — MCP-to-agent capture tested locally; Telegram/gateway pilot not run |
| FR47 | Batas tindakan Hermes | PARTIAL — four bridge tools and backend scopes enforced; no progress/Google/coding mutation; live channel pending |
| FR48 | Retry capture | PARTIAL — local intent ledger plus transactional server receipts per integration, replay/conflict and web/agent dedup tested locally; hosted concurrency pending |
| FR49 | Pemisahan runtime             | PARTIAL — standalone stdio bridge; no terminal/Google/GitHub tools. Live Hermes not tested                                                                                               |
| FR50 | Kegagalan Hermes              | NOT_STARTED                                                                                               |
| FR51 | Satu pemilik integrasi        | NOT_STARTED                                                                                               |
| FR52 | Credential dan pencabutan | PARTIAL — owner Settings, 256-bit token/hash storage, expiry/revoke/banned/deleted denial tested locally; no real grant issued |
| FR53 | Model dan biaya | DEFERRED by owner; no model calls or cloud fallback enabled. |
| FR54 | Health dan audit | PARTIAL — credential last-successful-use and hermes_integration domain actor; no heartbeat, full operational result ledger or live health claim |
| FR55 | Pemulihan dan perubahan versi | NOT_STARTED                                                                                               |
| FR56 | Pilot Windows                 | NOT_STARTED                                                                                               |

## External configuration required

Network is now enforced with the required Supabase hosts; core/research migrations and owner/profile were verified in the prior checkpoint. Only OWNER_AUTH_USER_ID is runtime-bound; remaining app settings are in ignored local configuration. Public signup remains enabled, OTP delivery/session is unverified, and agent migration 20261105154620_agent_api.sql is now applied hosted (hash and ACLs verified); live credential issuance/use remains unverified. Do not replay the two existing migrations or publish the environment again. Website and agent routes do not require a service-role key.

Live Google, Windows Hermes/Ollama and Telegram are separate later gates. No production credentials, Calendar events, Sheets writes, LLM calls, deployments or new research automations were created. Backup and 24/7 availability are not provided.

## Next implementation sequence

1. Validate core against owner development Supabase and SMTP; expand API/auth/rate-limit tests.
2. Complete category detail tables/forms, actual action/undo history and provenance proposals.
3. Extend internal Agenda with recurrence/exceptions, cancellation and workload; atomic snapshot reads remain beyond current sequential pagination.
4. Follow WP04–WP08 for provider/worker/research/agent delivery, then full acceptance and restore drill.

## Research/history continuation

See docs/RESEARCH_IMPORT.md and docs/INPUTS_REQUIRED.md. The linked Analytics Dashboard template was unavailable; owner explicitly chose to retain the current application design and adapt the template later. No claim of using the original template is made. Connected-app tools and read_thread were not exposed in this session; the provided conversation preview is historical context only. Native Git pushed feat/tracker-core successfully with owner authorization. Main was not merged.

Research code is validated against synthetic inputs/transport. No private Sheet rows were imported and no Google/Telegram side effects occurred. R01–R04 coverage is limited to normalized batches, not live DAILY_RESEARCH_LOG parsing. R05 remains NOT_RUN. Run corrections are preserved for review but cannot yet replace accepted history.

## Supabase project configuration checkpoint (historical; superseded above)

Project metadata, publishable key and owner email have now been supplied and prepared in ignored local configuration plus the environment draft. Both official Supabase skills were installed and read. Codex global MCP registration succeeded and project scope was verified. The runtime still denies Supabase domains with proxy CONNECT 403; MCP login stopped at OAuth metadata discovery. No hosted migration, Auth provisioning, OTP email or live domain writes occurred. OWNER_AUTH_USER_ID remains pending verification. See docs/SUPABASE_SETUP.md for the precise steps. The pasted application secret was not stored or used.

## Agenda pagination continuation

Removed the first-1,000-row limitation with bounded keyset reads and initial/final RLS counts. Exactly 10,000 rows can complete; larger inventories, request caps, missing/changing counts or non-advancing cursors are explicitly incomplete. A 5,000-milestone synthetic PGlite fixture proves the last-page overlap is returned through the real website API and visible on desktop/mobile. No schema/grant/RLS changes. Reads are sequential, not an atomic snapshot; P95 hosted performance remains unverified.

Pagination checkpoint checks: lint/typecheck/build PASS; 61 unit/database tests across 6 files PASS; 6 setup + 8 core/research/Agenda browser tests PASS. Live Supabase stays blocked on this instance; remote CI status remains unknown.

## Offline bridge and network diagnostics continuation (historical 43fe734 checkpoint)

User explicitly requested parallel work independent of live Supabase. Added a local WP07 adapter against isolated synthetic HTTP, with official pinned MCP SDK, four strict tools, private credential-file configuration, response projection, bounded retries and durable pending-intent SQLite ledger. This is not WP06: no agent API, grant issuance/revocation, server rate limits or server idempotency schema was created. No token was issued and no bot/model was started. See docs/MCP_BRIDGE.md for exact supported commands and remaining gates.

Network guide and no-credential diagnostic are in docs/CLOUD_NETWORK_TROUBLESHOOTING.md and scripts/cloud-network-check.mjs. Direct diagnostic returned PROXY_CONNECT_403 for all four Supabase hosts (expected exit 1). Current runtime remains revision 1 with no custom allowed hosts. No apply/restart/publish tool is exposed; opening a task with the correct published environment is a user-side action. This failure is separate from local bridge checks.

Integrated continuation checks: frozen-lockfile install PASS, lint/typecheck PASS, build:mcp PASS (also built by npm test), 75 unit/database/adapter tests across 7 files PASS, website production build PASS, 6 setup + 8 core/research/Agenda browser tests PASS. Remote CI remains unverified. See docs/RELEASE_EVIDENCE.md.

## Agent backend continuation

Implemented local WP06 core with four strict /api/agent routes, owner Settings credential management, scoped hashed tokens, account-status/expiry/revocation checks and database rate windows. Cookie and bearer channels are explicitly separated. Shared persist_draft preserves website semantics and transactionality; per-integration receipts keep retry keys isolated, and exact URL duplicates preserve personal progress. Agent migration generated using pinned Supabase CLI 3.0.0, then validated against PGlite and applied hosted after explicit owner approval; SQL checksum matches. No credential or tracker data was created remotely. See docs/AGENT_API.md for projection, pagination, retention and remaining gates.

Validation: lint/typecheck, website/MCP build, 94 tests / 8 files and 16 browser tests passed. Rechecked two agent browser cases after Auth-status guard changes and 32 affected agent/research tests after replay-boundary validation. Synthetic transport and database evidence only; no hosted grant or bot readiness claim.

Network diagnosis still exits 0; read-only public Auth settings still show signup enabled. No new OTP requested. Local acceptance uses synthetic Auth/PostgREST and actual database functions/stdio bridge. This does not prove hosted agent grants, delivery/session, Windows ACLs, Telegram identity, local-model capability, restore or H01–H24 completion. No environment publication, deployment, main merge or push performed.

## Agent migration hosted checkpoint

After explicit approval, applied agent_api once with unchanged SQL. Hosted version and local filename are now 20261105154620_agent_api.sql; SHA-256 fd1a14d8107ddd72440c63191e242e4badfe7bdd9ccb183b08f71829fe9222c2 matches the approved source. Hosted history was not rewritten. Verified table RLS, narrow RPC ACLs, private helper denial, empty search_path, two nullable fields and owner metadata read by role simulation. Direct hosted Data API rejects invalid agent credentials and anonymous owner RPC calls. Grant/receipt/opportunity counts remain zero; owner profile count remains one.

Advisors retain documented SECURITY DEFINER and password-protection warnings plus private deny-all RLS INFO. No actual grant, real hosted session test, website deployment, environment publication or push. See latest docs/RELEASE_EVIDENCE.md; live credential/OTP/restore/Windows acceptance remains pending.

## Milestone lifecycle continuation

Local source now supports owner edit, soft-cancel and restore of individual stored milestones. New update_milestone RPC validates parent + milestone revision, strict payload/date/zone/offset constraints, owner/parent linkage, and performs schedule/revision/history/outbox writes atomically. No-op edits/state requests add no domain writes. Cancelled rows retain their ID and schedule; editing requires restoration first. Saved personal progress is preserved.

Agenda filters active rows consistently across keyset pages and both counts; pure analysis ignores cancelled input. Agent deadline read retains existing token guards/ACLs and excludes cancelled deadlines. Lifecycle is not recurrence-instance cancellation, Google cleanup or a live provider capability. Migration 20261105165019_milestone_lifecycle.sql was applied hosted after explicit owner approval; source filename matches MCP-generated history and SQL bytes are unchanged. Three preceding migrations were not edited or replayed. See docs/MILESTONES.md.

Validation: 109 unit/database/adapter tests across 9 files, 6 setup + 12 core browser scenarios, lint/typecheck and website/MCP build passed. The new editor reuses creation fields and requires attendance explicitly to avoid defaulting a missing edit field to unknown. Local 5,000-row date-bound computation was reduced from 2,624ms to 32ms by request-local zone/day bounds caching; a cross-zone same-date test protects semantics. The original mobile buffer assertion passed without timeout relaxation after this change. This is local fixture evidence, not hosted P95 or OTP acceptance.

## Lifecycle hosted checkpoint

After explicit owner approval, lifecycle migration applied once as 20261105165019_milestone_lifecycle.sql. Approved SHA-256 104aeb21c7307cb98e1a3fb031c73e6e99a5c66a0e50b22537379696b9db553d matches hosted history. Local filename was aligned to MCP-generated history; SQL and prior history were not rewritten. Verified nullable cancellation column/index, retained milestone RLS, owner-only lifecycle EXECUTE, empty search_path and cancelled filter in agent_read. Hosted Data API rejects anonymous lifecycle writes and invalid agent credentials. Profile remains one; milestone/cancel/audit/outbox/grant counts remain zero.

Four migrations are now applied; do not replay them. Advisors retain the documented intentional SECURITY DEFINER warnings and password-protection finding. No user-domain mutation, token, OTP request, provider call, website deployment, environment publication or push. Positive real-owner JWT/session behavior remains a separate acceptance gate.

## Standard npm test and CI permissions fix

User requested fixing the reported npm run test error and pushing the feature branch. Public Actions run 42022251714 at 43fe734 exposed PRIVATE_FILE_PERMISSIONS and MCP startup failures; remote was five commits behind the local hosted/application checkpoints. Reproduced the same three MCP failures under POSIX umask 022 (local default 077 had hidden them). Test fixture now calls production prepareLedgerFile before opening SQLite and explicitly verifies existing permissive ledger files are rejected. Runtime security guards remain unchanged. Default Vitest maxWorkers=1 bounds concurrent WASM database setup; research cleanup tolerates a failed initialization without masking the primary error. CI explicitly exercises umask 022.

Standard npm run test passed 109 tests under both umask 022 and 077; lint/typecheck/production build passed. See latest release evidence for build/validation and the previously failing run link. Push was explicitly requested; no schema, provider or environment changes belong to this fix. Remote CI for the new push must be verified separately from local results.


## Owner data export continuation

Website work continues independently after the owner deferred local-model, Hermes and Telegram work. Settings now downloads a versioned private JSON export of all nine currently available public application tables, including archived opportunities, cancelled milestones, long before/after history and research snapshots/identities/proposals/correction metadata. Owner cookie/Origin/RLS, explicit column selection, bounded paging, count/ownership/key/relationship checks, per-table and payload SHA-256 and fail-without-partial-file behavior are implemented. Existing private operational/credential state and unimplemented entities/files are explicitly excluded. Sequential reads can miss count-stable edits; this is not backup or restore acceptance. See docs/OWNER_EXPORT.md.

Validation: standard umask 022 + npm run test **116 passed / 10 files**; lint/typecheck and website/MCP build passed. Browser **6 setup + 14 core passed** on desktop and 390px. Export browser coverage includes 355 synthetic historical entries and over 5,000 milestones, access/channel/origin denial, actual JSON attachment, error/retry and keyboard download. Both downloaded files passed the documented offline checksum verifier; a modified copy was rejected. Desktop/mobile screenshots were visually inspected. The synthetic transport now applies repeated filters with AND, matching profile keyset paging; production guards were not weakened. Release evidence records initial failures and final reruns.

No migration, hosted data export/import, real token/OTP, Google/provider/model/bot call, environment publication, deployment or main merge. Live OTP/session, Google integrations, complete recovery/export and backup remain separate work.


## Vercel readiness audit — 6 November 2026

Deployment preparation was preserved across the executor interruption; no implementation was replayed. Target is Vercel Hobby, Node 24.x, feature branch feat/tracker-core. Added framework/build configuration, CLI upload exclusions, private-cache/cookie refresh handling, basic response headers, redacted process/config health endpoint, safe logout failure reporting and a shared configuration/Auth-settings preflight. Public HTTP app origins and privileged Supabase key shapes are rejected. The export budget is now 4 MiB with a 45-second database deadline inside the 60-second Node route budget; earlier 16-MiB evidence is historical. No dependencies or SQL changed beyond Node engine metadata; four migration hashes remain unchanged.

Validation before the executor interruption: standard npm run test with umask 022 **127 passed / 13 files** (57.03s), production website/MCP build PASS, **6 setup + 16 core browser cases PASS** (12.6s and 2.0m). The preserved browser result reports passed/no failed tests. Final lint/typecheck were rerun successfully after workspace access returned. Build trace audit found no environment/private/historical-handoff paths in 23 application trace files. Evidence is synthetic, not a hosted owner-session acceptance claim.

Readiness remains BLOCKED for daily/live use: the current public Auth probe still reports signup enabled; local APP_URL is localhost; the owner confirms no Vercel project exists. OTP delivery and full hosted owner session/CRUD/export/logout plus backup/restore remain unverified. Preview of the limited website scope is the next deployment stage after secure configuration and explicit deployment authorization. Google integrations, recurrence and full PRD scope remain incomplete; model/Hermes/Telegram are deferred. See docs/VERCEL_DEPLOYMENT.md for operator steps. No environment publication, hosted migration/Auth setting change, main merge or deployment was performed by this audit.
