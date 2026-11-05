# Core development evidence

Environment: Linux cloud, Node 24.22.1, npm 11.9.0. Dependency versions are pinned in package.json/package-lock.json. Next 16.4.5, React 19.3.1, Supabase SSR 0.12.7, Zod 4.6.7, PostgreSQL PGlite 0.5.15.

| Command / check                               | Actual result            | Limit                                                                                  |
| --------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| npm ci --no-audit --no-fund                   | PASS                     | Frozen lockfile installation, no TLS or integrity bypass.                              |
| npm run lint                                  | PASS                     | Active app/lib/components/tests; archived source excluded.                             |
| npm run typecheck                             | PASS                     | next typegen + strict TypeScript.                                                      |
| npm test                                      | PASS, 23 tests / 3 files | 7 domain, 12 real PostgreSQL/PGlite tests, 4 configuration tests. No hosted provider.  |
| npm run build                                 | PASS                     | Production webpack build and route generation, two workers.                            |
| npm run test:e2e                              | PASS, 6 tests            | Desktop/mobile setup, navigation, no horizontal overflow, setup/API denial, not-found. |
| npm run test:e2e:core                         | PASS, 2 tests            | Desktop/mobile, synthetic Auth/PostgREST transport + real PGlite database.             |
| Handoff manifest                              | PASS, 57 hashes          | Original archive entries retained; no application-readiness claim.                     |
| Existing tracked files                        | Unchanged                | Baseline private documents were neither rewritten nor pushed.                          |
| Hosted Supabase / actual email OTP            | BLOCKED                  | Project, owner/profile and delivery configuration not supplied.                        |
| Google / Sheets / Hermes / Telegram / restore | NOT_RUN                  | Features remain pending; mocks do not release these gates.                             |
| GitHub Actions / production deploy            | NOT_RUN                  | Workflow supplied, not run remotely.                                                   |

Database tests verify fresh migration, authenticated owner read, other-user RLS isolation, anonymous denial, direct-write denial, private-table denial, duplicate and replay semantics, idempotency conflict, stale revisions, separate posting/personal stage, date-only persistence, missing/invalid event interval rejection, and rollback of domain changes when audit fails.

Core browser flow: unauthorized spoofed identity header → 401; email OTP fixture login; URL capture → one committed draft; update actual applied date/notes/category → revision increments; closed posting keeps applied stage; date-only milestone has no invented time; foreign Origin → 403; stale expected_revision → 409; recapture normalized URL → existing detail with unchanged personal notes/stage. Both desktop and 390 px checked.

Resolved test failures: desktop navigation numbering initially changed accessible link names (fixed decorative aria-hidden); exact label lookup on a wrapping select was replaced by accessible role/name; HTTP fixture originally serialized PostgreSQL DATE to JavaScript Date, unlike PostgREST (fixed SQL to_jsonb at fixture boundary). A database CHECK allowing null end_at for a timed event was tightened and regression-tested. Empty/malformed URL configuration is now handled as a setup issue instead of throwing from a Zod refinement.

Dependency note: ESLint 9.39.5 is pinned because the selected Next lint plugin tree rejects ESLint 10 peers. An ESLint 10 trial was reverted; npm ls reports no invalid eslint dependencies. npm emits a deprecation warning for ESLint 9. Upgrade the lint plugin set as a compatible group. This does not affect the production bundle.

Shell sandbox denied network/process capabilities during initial Git/build attempts. Commands succeeded through the supported reviewed execution path using the existing proxy and TLS trust; no route/proxy bypass or credential extraction occurred.

Environment configuration: install_script, start_skill and five non-secret variable requirements saved to the draft. Saving does not apply/publish; user reviews and saves in Environment Settings, then publishes. New-task restoration and hosted runtime behavior have not been tested. No service-role or Google credentials were requested or stored.

Development startup smoke: `npm run dev` reached ready; a local HTTP request returned 200 with the expected setup screen and inactive-storage notice. Next generated its managed AGENTS block; it is retained. Generated next-env.d.ts is ignored per the installed Next TypeScript guide and recreated by next typegen/dev/build.
