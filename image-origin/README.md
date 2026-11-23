# Rivers of Chile image origin

Serves objects from the `riversofchile-images` R2 bucket at
`https://riversofchile-images.pages.dev/<object-key>`.

The r2.dev URL (`pub-bb0d459c9c224a5ba3277f0ac5d9bff0.r2.dev`) is enabled as a fallback
but is a random hash; site markup should use this Pages hostname once the Function is
deployed. No custom DNS is required.

Deploy (from this directory), after `npx wrangler login` or a CI token:

```sh
npx wrangler pages deploy public --project-name=riversofchile-images
```

Wrangler picks up `functions/` and the R2 binding in `wrangler.toml`. Do not upload
media until the inventory and manifest are approved. The site itself is a separate
Pages project: `riversofchile` → `https://riversofchile.pages.dev`.
