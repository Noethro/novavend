# CODEX TASK-002A — Browser-Only Hosted Preview

## Objective

Provide NovaVend with a hosted frontend preview that the owner can open directly in Chrome without cloning the repository, installing Node.js, running Docker, or executing local commands.

The preview must be automatically rebuilt and deployed whenever approved changes are merged into `main`.

Expected public preview URL:

`https://noethro.github.io/novavend/`

This task deploys only the existing web frontend shell. It does not host the API, worker, PostgreSQL, Redis, authentication, or commerce logic.

## Branch

Implement this task on the existing branch:

`feature/task-002-core-tenancy-schema`

Do not create another branch. Do not commit directly to `main`.

## Required implementation

### 1. Conditional Next.js static export

Update `apps/web/next.config.ts` so that:

- Normal development and production builds retain the existing server-capable behavior.
- When `GITHUB_PAGES=true`, the web app builds as a static export using `output: 'export'`.
- GitHub Pages builds use the repository base path `/novavend`.
- Static assets resolve correctly under `/novavend`.
- Image optimization is disabled only when required for static export.
- Trailing-slash behavior is configured so direct navigation and refreshes work on GitHub Pages.
- Do not hard-code Pages behavior into normal local or future full-stack deployments.

### 2. GitHub Pages workflow

Create `.github/workflows/pages.yml` using the official GitHub Pages Actions:

- `actions/checkout`
- `pnpm/action-setup`
- `actions/setup-node`
- `actions/configure-pages`
- `actions/upload-pages-artifact`
- `actions/deploy-pages`

Requirements:

- Trigger on pushes to `main` and manual `workflow_dispatch`.
- Use frozen-lockfile installation.
- Build only after formatting, lint, typecheck, and relevant web tests pass.
- Build with `GITHUB_PAGES=true`.
- Supply a syntactically valid `NEXT_PUBLIC_API_URL` build variable without pretending that the API is hosted.
- Upload `apps/web/out` as the Pages artifact.
- Use the required `pages: write` and `id-token: write` permissions.
- Use the standard `github-pages` environment and expose the deployed URL as the environment URL.
- Use concurrency so a newer Pages deployment cancels an older in-progress deployment.
- Do not place secrets in the workflow or repository.

### 3. Preview behavior

The deployed site must:

- Load at `/novavend/`.
- Load the status page at `/novavend/status/`.
- Load CSS and JavaScript assets without 404 errors.
- Display a clear non-alarming label that this is a development preview.
- Not claim that API, database, authentication, or commerce functions are online.
- Not make failing browser calls to a nonexistent API from the current static pages.

Do not add dashboard, authentication, product, vendor, sale, delivery, or rental screens in this task.

### 4. Tests

Add or update automated tests to verify:

- Normal Next.js configuration remains server-capable when `GITHUB_PAGES` is not enabled.
- Pages configuration enables static export and `/novavend` base path when `GITHUB_PAGES=true`.
- Existing home and status pages render under the expected base-path assumptions.
- Static export completes successfully.
- Generated output contains the root and status HTML pages.

Keep all existing unit, integration, build, and E2E checks green.

### 5. Documentation

Update `README.md` with a short `Hosted preview` section containing:

- The preview URL.
- A statement that no local installation is required to view it.
- A statement that the Pages preview is frontend-only until a managed API and database deployment is added.
- The automatic deployment behavior after merges to `main`.

## GitHub Pages enablement limitation

GitHub may require Pages to be enabled once in repository settings with `GitHub Actions` selected as the publishing source. The standard workflow `GITHUB_TOKEN` may not be allowed to enable Pages automatically.

Do not request local setup from the owner. If repository-level Pages enablement blocks deployment, report only the exact single browser setting that must be changed. Do not substitute a local server.

## Acceptance criteria

1. The normal web build remains suitable for future server hosting.
2. `GITHUB_PAGES=true pnpm --filter @novavend/web build` produces `apps/web/out`.
3. The exported site works under `/novavend` rather than assuming the domain root.
4. The official Pages workflow is valid and contains no secrets.
5. The workflow deploys automatically after merge to `main` once Pages is enabled.
6. The preview is accessible from Chrome without local installation.
7. The current frontend does not falsely indicate that backend services are available.
8. Existing CI remains green.

## Completion report

Include in the final report:

- Files changed for browser preview support.
- Exact static-export command and result.
- Generated routes.
- Workflow validation result.
- Expected Pages URL.
- Whether GitHub Pages repository enablement is still required.
- Any limitation preventing the URL from becoming live.

Do not merge the pull request.
