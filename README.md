# Rivers of Chile (Astro + Directus)

Headless, fully static rebuild of [riversofchile.com](https://www.riversofchile.com).
Design comes later; this branch moves the published WordPress content onto the same
pattern as VPNReviewz: Directus on the NAS, Astro at build time, images on R2.

## Search indexing at migration

The default build is the noindex Pages beta. After the custom domains point to Astro, run `node scripts/river-indexing.mjs public` from the Peru Astro repository to enable search indexing on both sites and their image servers. Use `preview` to restore noindex or add `--dry-run` to inspect the commands. The command uses the signed-in GitHub CLI account to set both repositories’ RIVER_PRODUCTION variables and run their deployments. This sets production canonical links, language alternates, sitemap URLs, robots.txt and indexing headers. Keep separate preview builds on the default setting.

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

The Astro site is maintained on `main`. The previous Next.js app is available on
`legacy-next`.

## Automatic rebuilds

GitHub Actions workflow `.github/workflows/deploy-riversofchile.yml` builds against
live Directus and direct-uploads to the `riversofchile` Pages project (`--branch=main`).
It runs on:

- a push to `main` that changes site code
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

## Images: Directus File Library on R2

Images are native Directus files (`directus_files`, storage `r2`), kept in the
File Library under **River Sites > Rivers of Chile** (Peru Whitewater has its own
folder). Public URL rule: `https://riversofchile-images.pages.dev/<filename_disk>`.

- `roc_posts.featured_image`, `roc_pages.featured_image`, `roc_authors.avatar` are Image fields (M2O to files).
- `roc_posts.gallery` lists every photo used on a river page.
- File `description` is the caption/alt text shown in the lightbox; `metadata.variants` holds the resized WebP variants used for `srcset`.
- The build (`src/lib/directus.ts` + `src/lib/file-registry.mjs`) loads the file library with the read-only build token and resolves `featured_image` to the public R2 URL. Legacy WordPress `<img>` URLs in old body HTML still resolve through `data/images/manifest-v1.json`. Images an editor inserts with the WYSIWYG (`/assets/<id>`) are rewritten to the R2 URL at build time.
- `roc_media` is deprecated and hidden; it is kept only for reference.

## Redirects

Edit `public/_redirects` for permanent URL moves. Astro copies it into the build for Cloudflare Pages. For a Render static site, run `node scripts/render-routes.mjs` and use the resulting `routes` list in the service’s Blueprint. Render serves existing files before applying redirect rules.
