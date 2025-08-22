# Fix Local Dev DX

There are some issues that are causing friction in local development.

## Issues

- **Running tests**: Testing isn't working correctly. Both the server and client app packages have tests written but running them effectively from the project root is still not straightforward.
- **Launching apps in dev**: We need a solution for launching the app packages in development and hot reloading them when changes occur.
- **Environment management**: Environment variables are currently provided to the server from a `.env` file in the server package root folder. I want to centralize environment variable loading in the project root.
- **Dependency management**: I want to set the project up to use npm workspaces for centralized management of app workspaces.

## Remediation Plan

The goal is to make tests runnable from the root, support a one‑command dev workflow with hot reload for both packages, centralize environment handling, and clean up workspace hygiene. This plan is designed to be incremental and low‑risk.

### 1) Testing from the root

- Add root scripts in `package.json`:
  - `test`: `npm run -ws test`
  - `test:server`: `npm -w server run test`
  - `test:client`: `npm -w client run test`
- Ensure Jest ESM usage remains consistent (both packages already use `--experimental-vm-modules`).

### 2) Fix serverless handler alignment (tests + deploy)

- Create `server/src/index.js` that wraps `app` with `serverless-http` and exports `handler`.
- Remove or reconcile the stale `server/src/lambda.js` (wrong `.mjs` references); all code should be `.js` ESM.
- Update `template.yaml` to reflect the real layout:
  - `CodeUri: server`
  - `Handler: src/index.handler`
  - Standardize environment variable name as `YT_KEY` to match the codebase.
  - If using Secrets Manager, project its value into `YT_KEY`.

### 3) Dev launch with hot reload

- Root `dev` script to run both apps in parallel. Two options:
  - Minimal: `npm run -ws --if-present dev` (leverages each workspace’s `dev` script).
  - Polished: add `concurrently` and run explicit commands for server/client.
- Server: add `nodemon` as a dev dependency and change `server`’s `dev` to `nodemon server-dev.js`.
- Client: replace `python -m http.server` with `vite` for an instant dev server and live reload.

### 4) Centralize environment configuration

- Create a root `.env.example` (no secrets) and `.env` (ignored).
- Load env only in entrypoints, not libraries:
  - Remove `dotenv.config()` from `server/src/app.js`.
  - In `server/server-dev.js`, load the root `.env` explicitly.
- Remove the committed `server/.env` and rotate the leaked API key. Purge from history if possible.

### 5) Workspace hygiene

- Keep a single lockfile at the repo root. Remove `client/package-lock.json` and `server/package-lock.json`.
- Always install from the root (`npm install`) to leverage workspaces and hoisting.
- Optionally add `engines` and an `.nvmrc` to pin Node versions.

### 6) Documentation updates

- Update README “Local Development” section:
  - `cp .env.example .env` and fill `YT_KEY`.
  - `npm install` at repo root.
  - `npm run dev` to start both server and client.
  - `npm test` for the whole monorepo, or `npm run test:server` / `test:client` as needed.
  - Note `window.API_BASE` override for pointing the client at a custom API.

### 7) Optional quality improvements

- Add `eslint` + `prettier` with root scripts.
- Add a CI workflow to run tests on PRs and scan for secrets.

## Additional Call-outs

- `template.yaml` currently points to non-existent files (`CodeUri: src/server`, `Handler: test.handler`). This blocks deployment; the plan above corrects it.
- Server code assumes global `fetch` (Node 18+), which is fine; `template.yaml` targets Node 22.
- Tests mention `ENABLE_ORIGIN_CHECK` but `server/src/app.js` doesn’t consult it. If origin checking is desired in dev, add a conditional based on this flag.
