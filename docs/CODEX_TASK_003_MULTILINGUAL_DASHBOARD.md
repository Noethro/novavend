# CODEX TASK-003 — Multilingual Dashboard Foundation

## Role

Act as a senior frontend platform engineer and product UI engineer. Implement a production-ready internationalization foundation and a polished NovaVend dashboard shell without inventing backend functionality that does not yet exist.

Read these files completely before changing code:

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/CODEX_TASK_002A_BROWSER_PREVIEW.md`
- GitHub issue #2: multilingual dashboard foundation

## Objective

Turn the current frontend preview into a real, responsive dashboard shell that can be viewed directly in Chrome and switched between six supported languages:

- English — `en`
- Turkish — `tr`
- German — `de`
- Russian — `ru`
- Simplified Chinese — `zh-CN`
- Japanese — `ja`

This task establishes the UI shell and localization architecture for all future dashboard work. It does not implement authentication, API integration, products, vendors, sales, delivery, devices, rentals, or other commerce workflows.

## Branch and pull request

Work only on the existing branch:

`feature/task-003-multilingual-dashboard`

Do not create another branch.
Do not commit directly to `main`.
Open one draft pull request targeting `main` when complete.
Do not merge the pull request.

## Required localization architecture

### Locale model

Create a typed locale model with exactly these initial locale identifiers:

- `en`
- `tr`
- `de`
- `ru`
- `zh-CN`
- `ja`

English is the required fallback locale.

Use a maintainable dictionary structure. User-facing strings must not be hard-coded inside React components. Translation dictionaries must be reviewable source files committed to the repository. Do not use runtime machine translation or an external translation service.

The type system or validation tests must detect missing required keys. A missing runtime key must fall back safely to English rather than rendering a blank value or crashing.

### Locale resolution

On first browser visit, resolve the locale in this order:

1. A previously saved NovaVend locale preference.
2. The browser language when it maps to a supported locale.
3. English fallback.

Required browser mappings include:

- `tr-*` → `tr`
- `de-*` → `de`
- `ru-*` → `ru`
- `zh-CN`, `zh-SG`, and compatible Simplified Chinese browser tags → `zh-CN`
- `ja-*` → `ja`
- unsupported locales → `en`

Persist the chosen locale in a namespaced browser storage key. Handle unavailable or blocked browser storage without crashing.

Avoid hydration mismatch and visible language flashing. The implementation must be safe for Next.js static export. Do not require middleware, server sessions, cookies, or runtime server rendering for locale selection.

### Formatting

Provide shared typed helpers using the platform `Intl` APIs for:

- dates
- times
- integers
- decimals
- percentages
- Second Life currency values

Second Life amounts remain labeled as `L$`. Format the numeric portion according to the selected locale but do not convert it to another currency.

Formatting helpers must have deterministic tests. Do not scatter direct `Intl` construction throughout arbitrary components.

## Required dashboard shell

Replace the basic preview page with a polished, responsive application shell suitable for future merchant tools.

### Layout

The shell must include:

- NovaVend product identity
- development-preview badge
- desktop sidebar navigation
- compact mobile navigation or drawer
- top bar
- visible language selector
- workspace placeholder showing that workspace selection will arrive later
- clear frontend-only status messaging
- accessible keyboard focus states

Use the existing Tailwind and shared UI package. Add shared primitives to `packages/ui` only when they are genuinely reusable. Do not add a second unrelated styling system.

### Navigation

Display these localized navigation items:

- Overview
- Products
- Vendors
- Sales
- Deliveries
- Customers
- Devices
- Analytics
- Settings
- System status

Only Overview and System status may navigate to real pages in this task. Other items must be visibly marked as coming soon and must not route to fake functional screens. They must not trigger broken links.

### Overview page

The root page must look like a genuine dashboard while clearly using non-live preview data. Include:

- localized page title and welcome text
- setup progress section
- four summary cards using explicit preview/sample values
- recent activity empty state
- device health empty state
- quick-start checklist
- a clear statement that live data will appear after backend and Second Life device integration

Suggested summary-card concepts:

- Products
- Sales today
- Pending deliveries
- Online devices

The values must be labeled as demo or preview values and must not imply live commerce activity.

### System status page

Preserve `/status` and redesign it within the same dashboard shell.

Display localized status rows for:

- Frontend preview
- API
- Database
- Redis/queue
- Authentication
- Second Life device network

Only the static frontend preview may show as available. All unhosted services must show a neutral `Not connected yet` or equivalent state rather than an alarming outage state.

Do not make browser requests to nonexistent endpoints in the GitHub Pages preview.

### Language selector

The language selector must:

- show native language names
- be usable by keyboard
- have an accessible label
- update the entire visible shell immediately
- persist across reloads
- update the root document `lang` attribute
- work on both desktop and mobile layouts
- work under the `/novavend` GitHub Pages base path

Native labels:

- English
- Türkçe
- Deutsch
- Русский
- 简体中文
- 日本語

## Translation quality

Translate all visible TASK-003 UI text into all six languages. Do not leave English placeholders in non-English dictionaries.

Use concise product-interface language rather than literal word-for-word translations. Keep the product name `NovaVend` unchanged. Keep `L$` unchanged.

Automated completeness tests are required, but machine-generated-looking or obviously incorrect translations are not acceptable. Ensure punctuation and common interface terminology are appropriate for each language.

## Routing and GitHub Pages compatibility

Use a client-side locale strategy without locale-prefixed routes unless the current architecture provides a clearly safer static-export alternative.

Required routes remain:

- `/novavend/`
- `/novavend/status/`

Requirements:

- direct navigation and refresh continue to work
- CSS and JavaScript assets continue to load under `/novavend`
- the language selection works without changing to invalid paths
- normal server-capable Next.js builds remain supported when `GITHUB_PAGES` is not enabled
- static export still produces `apps/web/out/index.html` and `apps/web/out/status/index.html`

Do not break the existing Pages workflow.

## Accessibility and responsive behavior

Meet these minimum requirements:

- semantic landmarks
- one clear page heading
- keyboard-accessible navigation and language controls
- visible focus indicators
- sufficient text/background contrast
- meaningful accessible names for icon-only controls
- no horizontal overflow at common mobile widths
- usable at 320px, 768px, 1280px, and wider desktop widths
- respect reduced-motion preferences for nonessential transitions

Do not hide essential content on mobile.

## State and component rules

- Keep locale state in one clear provider/store boundary.
- Avoid a heavy global state library unless already installed and clearly justified.
- Avoid duplicate locale logic in pages.
- Keep dictionaries separate from components.
- Keep navigation definitions typed and localized through keys.
- Do not expose untyped string-key lookups throughout the application.
- Do not add API calls or mock service workers.
- Do not add authentication shortcuts.

## Tests

Add unit tests for:

1. Supported locale validation.
2. Browser-language normalization.
3. Locale resolution precedence.
4. English fallback for unsupported locales.
5. Dictionary key completeness across all six languages.
6. Missing-key fallback behavior.
7. Safe behavior when local storage throws or is unavailable.
8. Locale persistence.
9. Date, number, percentage, and `L$` formatting.
10. Navigation configuration and coming-soon behavior.

Add React rendering tests for:

1. Dashboard shell rendering in English.
2. Each of the six locale dictionaries rendering representative UI text.
3. Language selector changing the visible interface.
4. Status page showing only the frontend as available.
5. No unhosted-service fetch attempt during static rendering.
6. Mobile navigation accessibility.

Add Playwright coverage for the hosted-preview behavior:

1. Open the dashboard.
2. Change from English to Turkish.
3. Verify translated content.
4. Reload and verify Turkish persists.
5. Change to another non-Latin locale such as Japanese or Simplified Chinese.
6. Navigate to System status and verify localization persists.
7. Verify no failed navigation caused by the `/novavend` base path.
8. Verify desktop and mobile viewport smoke behavior.

Update static-export verification to ensure:

- root and status HTML files exist
- generated assets use `/novavend/_next/`
- expected dashboard shell markers exist in exported output where applicable

## Documentation

Create or update:

- `README.md`
- `docs/INTERNATIONALIZATION.md`
- `docs/ARCHITECTURE.md` when the provider/component boundary needs documentation

`docs/INTERNATIONALIZATION.md` must explain:

- supported locales
- fallback rules
- browser detection
- persistence key
- dictionary structure
- adding a translation key
- adding a new language
- formatting helpers
- testing expectations
- GitHub Pages/static-export constraints

Update the README hosted-preview section to mention the language selector and six supported languages after this task is merged.

## CI and validation

Keep existing CI green and make the new tests part of standard commands.

Before completion run:

1. `pnpm format:check`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm db:check`
6. `pnpm test:integration`
7. `pnpm build`
8. `GITHUB_PAGES=true pnpm --filter @novavend/web build`
9. `pnpm --filter @novavend/web test:static-export`
10. `pnpm test:e2e`

If Docker or Playwright binaries are unavailable locally, still attempt the commands, report the exact local limitation, and rely on the required GitHub Actions jobs for authoritative PostgreSQL, Redis, and Chromium validation. Do not claim those tests passed locally when they did not.

## Explicitly out of scope

Do not implement:

- registration or login
- authentication or sessions
- real workspace switching
- API hosting
- database hosting
- products CRUD
- vendors CRUD
- sales processing
- delivery processing
- device pairing or heartbeat
- customer records
- analytics calculations
- rentals
- affiliates
- loyalty
- coupons
- gift cards
- Marketplace integration
- runtime machine translation
- locale-prefixed server middleware requiring a hosted Next.js server

## Acceptance criteria

1. The Chrome preview presents a polished dashboard shell rather than the old basic preview page.
2. All visible UI text exists in English, Turkish, German, Russian, Simplified Chinese, and Japanese.
3. English is the safe fallback locale.
4. Browser language is detected only when no saved preference exists.
5. The selected language persists across reloads.
6. The document language attribute follows the selected locale.
7. Dates, numbers, percentages, and `L$` values use shared locale-aware formatting.
8. Dictionary completeness is enforced by type checking or tests.
9. Overview and System status work; future navigation items are clearly nonfunctional and do not create broken routes.
10. The preview makes no calls to unhosted services.
11. Desktop and mobile layouts are accessible and responsive.
12. Normal Next.js builds and GitHub Pages static exports both succeed.
13. `/novavend/` and `/novavend/status/` continue working after deployment.
14. Existing tenancy code, migrations, integration tests, and CI remain unchanged and green.
15. One draft PR is opened and is not merged before technical review.

## Completion procedure

1. Confirm the branch is `feature/task-003-multilingual-dashboard`.
2. Synchronize with the latest remote state without switching to another feature branch.
3. Implement all requirements.
4. Run all validation commands.
5. Fix every in-scope failure.
6. Commit and push the branch.
7. Open one draft PR targeting `main`.
8. Do not merge.

## Required final report

Return:

- Draft PR link
- Final commit SHA
- Complete changed-file list
- Localization architecture summary
- Supported locale list
- Persistence key and locale-resolution order
- Dashboard routes and navigation behavior
- Exact unit/render/Playwright test counts
- Normal build result
- Static-export result and generated routes
- CI run link and results
- Hosted preview URL expected after merge
- Local environment limitations
- Known limitations
- Deviations from this task, if any

Stop and report rather than guessing if the installed Next.js version or static-export architecture conflicts with these requirements.