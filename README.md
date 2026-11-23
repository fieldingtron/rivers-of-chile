# Rivers of Chile (Astro + Directus)

Headless, fully static rebuild of [riversofchile.com](https://www.riversofchile.com).
Design comes later; this branch moves the published WordPress content onto the same
pattern as VPNReviewz: Directus on the NAS, Astro at build time, images on R2.

## Beta hosts (no DNS changes)

- Site: [https://riversofchile.pages.dev](https://riversofchile.pages.dev) (Pages project `riversofchile`)
- Images: [https://riversofchile-images.pages.dev](https://riversofchile-images.pages.dev) (Pages Function in `image-origin/` in front of the `riversofchile-images` R2 bucket)
- Temporary R2 development URL: `https://pub-bb0d459c9c224a5ba3277f0ac5d9bff0.r2.dev` (random hash; prefer the Pages hostname)

The beta is noindex: `public/_headers` (`X-Robots-Tag: noindex, nofollow`), a robots meta tag, and `robots.txt` `Disallow: /`.

## Local development

```sh
pnpm install
pnpm snapshot          # rebuild data/snapshot from a WordPress REST export
pnpm build && pnpm check
pnpm dev
```

Local builds without `DIRECTUS_BUILD_TOKEN` read `data/snapshot/`. Hosted builds require that token and fail if published `roc_posts` / `roc_pages` cannot be fetched.

## Directus

Collections are prefixed `roc_*` on the shared instance at `https://content.fieldsmarshall.com`.
Administrator (Fields) sees every site. The **River Sites Editor** role/policy is for a friend
who should only see river-guide collections (`roc_*` now; `peru_*` can be added to the same
policy later) and never `vpnreviewz_*`. The friend’s user is not created until we have their email.

```sh
# Token is read from the environment. It is never printed.
# The read-only build token is written to /workspace/roc/.directus_build_token (gitignored).
DIRECTUS_ADMIN_TOKEN=… pnpm directus:setup
DIRECTUS_ADMIN_TOKEN=… pnpm directus:import
```

## Environment

See `.env.example`. Never prefix secrets with `PUBLIC_`.

## Images

WordPress media is downloaded read-only, processed, and uploaded to the
`riversofchile-images` R2 bucket. Objects are stored in R2 under
`migrated-media/<name>-<width>x<height>-<20hex-sha256>.<ext>` (plus 400/800/1200w
WebP variants when the source is larger; no upscale). Public URLs omit that prefix:
`https://riversofchile-images.pages.dev/<name>-….<ext>`. The Pages Function also
serves the older `/migrated-media/…` paths as an alias, and supports HTTP Range
so large videos can seek. PDFs and video are stored as-is.

The old-URL → new-key map is `data/images/manifest-v1.json`. The Astro build rewrites
`<img>`, `srcset`, and featured-image URLs to the public image origin.
`roc_media` keeps the original WordPress `source_url` (shown as “Original WordPress URL”)
and alt text, and records a live `url` on `riversofchile-images.pages.dev`, `r2_key`
(the public path, without `migrated-media/`), `variants` (each with its own `url` and
public `r2_key`), `sha256`, and `status`.

```sh
# Read-only GETs against live WordPress. Failures (404s) are listed in .image-migration/download-report.json
pnpm images:download
# Process variants, upload to R2, write the manifest, update Directus
CLOUDFLARE_API_TOKEN=… DIRECTUS_ADMIN_TOKEN=… pnpm images:migrate
```

`.image-migration/` is gitignored (local originals and encoded variants). The manifest is committed.

## Rebuild and deploy

The beta uses Cloudflare Pages **direct upload**, not a git-connected build, so
`DIRECTUS_BUILD_TOKEN` is not stored as a Pages secret. Builds run locally against
live Directus, then the `dist/` folder is uploaded.

```sh
pnpm install

# 1) Image origin (Pages Function in front of R2). Once per change to image-origin/.
cd image-origin
npx wrangler pages deploy public --project-name=riversofchile-images --branch=main
cd ..

# 2) Site: fetch published roc_* from Directus and emit a static tree
export DIRECTUS_URL=https://content.fieldsmarshall.com
export DIRECTUS_BUILD_TOKEN=   # read-only build token; never commit
pnpm build && pnpm check

# 3) Upload dist/ to the riversofchile Pages project (production / pages.dev)
npx wrangler pages deploy dist --project-name=riversofchile --branch=main --commit-dirty=true
```

Local fallback: if `DIRECTUS_BUILD_TOKEN` is unset, `pnpm build` uses `data/snapshot/`
instead of live Directus. That is for offline work only; the beta deploy should always
be built against live Directus.

Production URL: https://riversofchile.pages.dev  
Image origin: https://riversofchile-images.pages.dev  

Do not push this work to `main`. The Astro site lives on the `astro-directus` branch;
`main` still has the previous Next.js app (also saved as `legacy-next`). No DNS changes
are required for the pages.dev beta.

## Automatic rebuilds

GitHub Actions workflow `.github/workflows/deploy-riversofchile.yml` builds against
live Directus and direct-uploads to the `riversofchile` Pages project (`--branch=main`).
It runs on:

- a push to `astro-directus` (the workflow file also lives on `main` so dispatch works;
  the default branch still holds the previous Next.js app)
- manual **Run workflow** (`workflow_dispatch`)
- `repository_dispatch` with `event_type: directus-rebuild`, after a 60-second debounce

Required repository secrets (never commit these):

- `DIRECTUS_BUILD_TOKEN` — read-only Directus build token
- `CLOUDFLARE_API_TOKEN` — Cloudflare account token with **Pages Write** and **Account Settings Read** only (token name `riversofchile-pages-deploy`)
- `CLOUDFLARE_ACCOUNT_ID` — `380ad23988b4ff82b4994eac826b8bab`

To hook Directus up, create a fine-grained GitHub personal access token with access
only to `fieldingtron/rivers-of-chile` and **Contents: Read and write**, then add a
Directus Flow on `roc_*` item create/update/delete that `POST`s:

```
https://api.github.com/repos/fieldingtron/rivers-of-chile/dispatches
Accept: application/vnd.github+json
Authorization: Bearer <github-token>
{"event_type":"directus-rebuild"}
```

Do not store that GitHub token in the repo.
