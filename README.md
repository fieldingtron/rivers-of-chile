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

See `.env.example`. Never prefix secrets with `PUBLIC_`. Cloudflare Pages should store `DIRECTUS_BUILD_TOKEN` as an encrypted build secret.
