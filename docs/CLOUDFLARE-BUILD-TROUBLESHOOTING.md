# Cloudflare dependency installation and deployment target

## Failure observed on 28 September 2026

The supplied build log checked out commit `d8f0627`, detected Bun 1.2.15 and ran
`bun install --frozen-lockfile`. That installer rejected `bun.lock` with
`Unknown lockfile version` before the application build command ran.

CX3 CI uses npm and the committed `package-lock.json`. The fix removes the competing
root Bun lockfile, ignores future root `bun.lock`/`bun.lockb` files and declares npm
in `package.json`. No dependency resolutions or application data have been changed.
Do not hand-edit the Bun lockfile version, remove the npm lock or disable frozen
installation as a workaround.

`.node-version` selects the maintained Node 22 line, matching CI's Node 22 selection.
An explicit old dashboard `NODE_VERSION` override must also be removed or updated.
The supplied image used 22.16.0, while some locked development dependencies require
at least 22.22.2 within the Node 22 line. The packageManager declaration documents
npm tooling; deterministic installation comes from `npm ci` and package-lock.json,
not an assumption that every host enforces the packageManager declaration.

## Deterministic dashboard install

Apply to the relevant production/preview build settings in the existing project:

- Build environment variable: `SKIP_DEPENDENCY_INSTALL=1`.
- Node override, when needed: `NODE_VERSION=22`, or remove it to use `.node-version`.
- Build command: `npm ci --ignore-scripts --no-audit && npm run build`.
- Repository root: the directory containing `package.json` (this repository's root).
- Deploy the new `main` commit containing this fix, not another retry of the old SHA.

The explicit skip is important: changing only the build command does not override
an automatic installation that fails before the build command starts. It also makes
the install path unambiguous if a tool later regenerates an ignored local Bun lockfile.
Do not set `NODE_ENV=production` or `NPM_CONFIG_PRODUCTION=true` during dependency
installation when running the complete verification suite, because it needs devDependencies.
The Cloudflare Worker build already fixes the application's runtime NODE_ENV to production.

## Pages and Workers are different deployment targets

The supplied log resembles the Pages build pipeline. Confirm the product in the
dashboard rather than treating a successful static build as a working API deployment.

For a **Pages frontend-only** deployment, use output directory `dist/client`, never
the repository root or the combined `dist` directory containing server bundles.
This does not execute `server/cloudflare/worker.ts` or activate the CLI archive.
No Pages Functions adapter or API proxy is installed by this dependency fix.

For the selected **Workers + R2** implementation, deploy the actual Worker entry point
with an explicit, reviewed Wrangler configuration, as described in [CLI-CLOUDFLARE-R2.md](CLI-CLOUDFLARE-R2.md).
Workers Builds requires its own build command and deploy command. For example, after
reviewing a configuration stored in the build environment:

```bash
npx --yes wrangler@4.142.0 deploy --config <reviewed-worker-config.jsonc>
```

`wrangler.cloudflare.example.jsonc` is an example, not an auto-discovered production
configuration. The ignored local configuration is not present in a fresh Git checkout.
The example must be reconciled with the real account, R2 binding, existing variables,
routes and privacy controls before using it for deployment. Do not copy it into a root
Pages configuration to silence the non-fatal `No Wrangler configuration file found` line.
No cloud settings, R2 bucket, binding, credentials or automatic deployment workflow
are created by this fix. Build and storage activation remain separate checks.

## Verification

Run `npm ci --ignore-scripts --no-audit && npm run verify` on Node 22.
The dependency-installation regression tests prevent alternate root lockfiles,
check that npm dependency declarations match the committed lock, and retain the
npm installation path in both CI workflows. The existing Cloudflare validation
workflow additionally bundles and boots the Worker using local emulated bindings.
A passing CI run does not prove a successful production deployment or R2 import.

Official references:
- https://developers.cloudflare.com/pages/configuration/build-image/#skip-dependency-install
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
