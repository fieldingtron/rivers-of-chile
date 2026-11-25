# Rivers of Chile image origin

Serves objects from the `riversofchile-images` R2 bucket at
`https://riversofchile-images.pages.dev/<filename>`.

R2 object keys still use a `migrated-media/` prefix; public URLs omit it.
Requests to `/migrated-media/<filename>` are served as an alias. The Function
supports HTTP Range (`206 Partial Content`, `Accept-Ranges: bytes`) so large
videos can seek, and answers `HEAD` as well as `GET`.

The r2.dev URL (`pub-bb0d459c9c224a5ba3277f0ac5d9bff0.r2.dev`) is enabled as a fallback
but is a random hash; site markup should use this Pages hostname once the Function is
deployed. No custom DNS is required.

Deploy (from this directory), after `npx wrangler login` or a CI token:

```sh
npx wrangler pages deploy public --project-name=riversofchile-images --branch=main
```

Wrangler picks up `functions/` and the R2 binding in `wrangler.toml`. The site itself
is a separate Pages project: `riversofchile` → `https://riversofchile.pages.dev`.
