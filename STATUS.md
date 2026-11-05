# Implementation status

Baseline repository: `83161ffd53d4dda2099790f966332dc7cd3058e3` (historical handoff documents). Existing tracked documents were preserved. Imported archive: 57 SHA-256 entries verified; 40 missing files added. The archive is not an executable application.

## Current scope

WP00 audited; WP01–02, a small WP03 slice, and the manual research/history subset of WP05 implemented. New standard Next.js application is separate from the legacy reference archive. G1 hosted/live acceptance remains BLOCKED by missing Supabase project/owner configuration. G2–G5 are not released. This is not the complete PRD or a production-ready tracker.

| Work package | Status                           | Actual result / remaining work                                                                                                                                                                                                                                            |
| ------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WP00         | IMPLEMENTED_UNVERIFIED           | Baseline audit, ADR-001, dependency pins, lockfile, file map and privacy review. No hosted release.                                                                                                                                                                       |
| WP01         | TESTED_MOCK (core subset)        | SQL migrations, owner/RLS, transactional draft/update/milestone + immutable history and blocked outbox. Hosted migration/Auth email not tested; broad domain model, worker grants and rate limits incomplete.                                                             |
| WP02         | IN_PROGRESS                      | Seven menus, OTP form, capture/list/detail/progress/archive/search, exact URL dedup, revision conflict. Category-specific full forms, actions/undo entities, contacts/documents and extraction proposals remain.                                                          |
| WP03         | IN_PROGRESS                      | Date-only versus explicit-offset instant, milestones and basic interval pure function. Recurrence/exceptions, conflict UI, workload/capacity editing and reminders remain.                                                                                                |
| WP04         | NOT_STARTED                      | Google OAuth, Calendar/FreeBusy, encryption, worker/scheduler, retry/conflict resolution and legacy cutover.                                                                                                                                                              |
| WP05         | IN_PROGRESS                      | TESTED_MOCK subset: normalized JSON preview/apply, immutable R01–R04 snapshots, carry-forward, replay/correction quarantine, public field review, 300-row/rollback checks. Live Sheet/header parser, R05, correction acceptance, recovery, full export and backup remain. |
| WP06         | NOT_STARTED                      | Agent API, scoped credential mint/revoke and rate limits. Website cookie API is not the agent API.                                                                                                                                                                        |
| WP07         | NOT_STARTED                      | Four-tool stdio MCP bridge and durable local ledger.                                                                                                                                                                                                                      |
| WP08         | BLOCKED (live); code NOT_STARTED | Windows Hermes, local Ollama, bot private-owner configuration and H19 require owner laptop. Runbook remains design, not execution evidence.                                                                                                                               |
| WP09         | IN_PROGRESS (core checks only)   | Unit/database and browser harnesses. Full FR/INT/H/R acceptance not executed.                                                                                                                                                                                             |
| WP10         | IN_PROGRESS                      | Runnable README, ADR, CI definition and environment instructions; no production release/push/merge.                                                                                                                                                                       |

## Validation evidence

See `docs/RELEASE_EVIDENCE.md` for actual commands, counts and limitations. CI workflow is supplied but a GitHub Actions run is not claimed. Browser transport fixtures use synthetic Supabase responses and real PGlite PostgreSQL. They do not prove hosted Supabase or live email.

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
| FR09 | Milestone dinamis             | PARTIAL — milestones SQL/API/UI; editing/cancellation remain                                              |
| FR10 | Presisi jadwal                | PARTIAL — DATE vs instant+offset+IANA zone; recurrence/DST wall-time resolution remains                   |
| FR11 | Bentrok interval              | PARTIAL — overlap pure function only; no coverage-aware UI                                                |
| FR12 | Batas interval                | PARTIAL — half-open interval unit test; complete scheduling engine remains                                |
| FR13 | Deadline                      | NOT_STARTED                                                                                               |
| FR14 | Calendar terpilih             | NOT_STARTED                                                                                               |
| FR15 | Sync berulang                 | NOT_STARTED                                                                                               |
| FR16 | Kegagalan eksternal           | NOT_STARTED                                                                                               |
| FR17 | Perubahan remote              | NOT_STARTED                                                                                               |
| FR18 | Sesi berulang                 | NOT_STARTED                                                                                               |
| FR19 | Tahapan bersyarat             | PARTIAL — conditional attendance stored and displayed; lifecycle handling remains                         |
| FR20 | Pengingat                     | NOT_STARTED                                                                                               |
| FR21 | Impor riset                   | PARTIAL — normalized JSON preview/apply and immutable run snapshots; live Sheet parser NOT_STARTED        |
| FR22 | Kepemilikan field             | PARTIAL — no personal overwrite; per-field public review + revision/RLS; live migration NOT_STARTED       |
| FR23 | Koreksi darurat               | NOT_STARTED                                                                                               |
| FR24 | Cutover                       | NOT_STARTED                                                                                               |
| FR25 | Restore                       | NOT_STARTED                                                                                               |
| FR26 | Unknown biaya                 | NOT_STARTED                                                                                               |
| FR27 | Sparse update                 | PARTIAL — sparse website update + public-only research proposals; replay and personal preservation tested |
| FR28 | Transaksi domain              | PARTIAL — SQL transactional capture/update/milestone+audit+blocked outbox; broader model remains          |
| FR29 | Identitas URL                 | PARTIAL — canonical URL preserves job identity; database tests                                            |
| FR30 | Owner dan sesi                | PARTIAL — verified owner, RLS, no direct writes, Origin checks; hosted tests BLOCKED                      |
| FR31 | Identitas OAuth               | NOT_STARTED                                                                                               |
| FR32 | Antrean Calendar              | NOT_STARTED                                                                                               |
| FR33 | Cleanup agenda                | NOT_STARTED                                                                                               |
| FR34 | Resolusi remote               | NOT_STARTED                                                                                               |
| FR35 | Calendar legacy               | NOT_STARTED                                                                                               |
| FR36 | Mapping sumber                | NOT_STARTED                                                                                               |
| FR37 | Preview yang sah              | NOT_STARTED                                                                                               |
| FR38 | Ekspor lengkap                | NOT_STARTED                                                                                               |
| FR39 | Scheduler nyata               | NOT_STARTED                                                                                               |
| FR40 | Konfigurasi jujur             | PARTIAL — setup/errors and truthful integration states; provider health remains                           |
| FR41 | Kesiapan GitHub               | PARTIAL — source/lockfile/CI/runbook; no remote CI or release                                             |
| FR42 | Capture tahan gagal           | PARTIAL — committed manual draft independent of extraction; extractor NOT_STARTED                         |
| FR43 | Peran kanal                   | NOT_STARTED                                                                                               |
| FR44 | Akun Telegram                 | NOT_STARTED                                                                                               |
| FR45 | Jawaban berbasis data         | NOT_STARTED                                                                                               |
| FR46 | Capture Telegram              | NOT_STARTED                                                                                               |
| FR47 | Batas tindakan Hermes         | NOT_STARTED                                                                                               |
| FR48 | Retry capture                 | NOT_STARTED                                                                                               |
| FR49 | Pemisahan runtime             | NOT_STARTED                                                                                               |
| FR50 | Kegagalan Hermes              | NOT_STARTED                                                                                               |
| FR51 | Satu pemilik integrasi        | NOT_STARTED                                                                                               |
| FR52 | Credential dan pencabutan     | NOT_STARTED                                                                                               |
| FR53 | Model dan biaya               | NOT_STARTED                                                                                               |
| FR54 | Health dan audit              | NOT_STARTED                                                                                               |
| FR55 | Pemulihan dan perubahan versi | NOT_STARTED                                                                                               |
| FR56 | Pilot Windows                 | NOT_STARTED                                                                                               |

## External configuration required

Owner: create a development Supabase project, disable signup, provision one owner and profile, configure email OTP delivery, fill the five variables from `.env.example`, and allow the actual project hostname in restricted networking. No secrets requested in chat. The app does not need a service-role key for CRUD.

Live Google, Windows Hermes/Ollama and Telegram are separate later gates. No production credentials, Calendar events, Sheets writes, LLM calls, deployments or new research automations were created. Backup and 24/7 availability are not provided.

## Next implementation sequence

1. Validate core against owner development Supabase and SMTP; expand API/auth/rate-limit tests.
2. Complete category detail tables/forms, actual action/undo history and provenance proposals.
3. Implement recurrence/exceptions and coverage-aware conflict/workload engine.
4. Follow WP04–WP08 for provider/worker/research/agent delivery, then full acceptance and restore drill.

## Research/history continuation

See docs/RESEARCH_IMPORT.md and docs/INPUTS_REQUIRED.md. The linked Analytics Dashboard template was unavailable; owner explicitly chose to retain the current application design and adapt the template later. No claim of using the original template is made. Connected-app tools and read_thread were not exposed in this session; the provided conversation preview is historical context only. Native read-only Git succeeded; no push was attempted.

Research code is validated against synthetic inputs/transport. No private Sheet rows were imported and no Google/Telegram side effects occurred. R01–R04 coverage is limited to normalized batches, not live DAILY_RESEARCH_LOG parsing. R05 remains NOT_RUN. Run corrections are preserved for review but cannot yet replace accepted history.
