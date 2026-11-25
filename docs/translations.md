# Updating the Spanish edition

The English source stays in `public.roc_posts` and `public.roc_pages`. The PostgreSQL schema `roc_i18n` holds one Spanish row per original, linked by its database ID. The schema sits outside the Directus content interface. There is no reverse relation, translation field, or permission on Kurt’s collections. River grades, coordinates, photos, and authors continue to come from the original record.

Use a PostgreSQL connection to the site database with access to the private schema. The commands use standard `psql` connection settings. The initial schema is in `scripts/migrations/roc-translations.sql`.

1. Run `python3 scripts/translations.py pending > pending.json`. Each entry includes its English text, slug, and source checksum. An empty array means all published originals have matching translations.
2. Have Sol translate or revise those entries and compare the result with the English. For each reviewed entry add a `translation` object with the translated fields, retaining the original checksum. Preserve rapid grades, river left and right, mandatory portages, units, warnings, and link targets. A batch may contain just the entries ready to save.
3. Run `python3 scripts/translations.py apply reviewed.json`. The transaction only accepts missing or changed entries whose English checksum still matches. A concurrent source edit requires fetching the pending entry again.
4. Run `python3 scripts/translations.py export`, then `pnpm build && pnpm check`. Include the two updated files under `data/es/` in the site release. Astro serves these static translations under `/es/`.

The comparison covers titles, bodies, SEO text and, for guides, excerpts and translated access or season notes. Republishing unchanged wording leaves the Spanish current. Editing an English paragraph flags that entry even if its publication date stays the same. Unpublishing an original removes it from the next export. Comment translations retain an expandable original.

## Adding a language later

English is the source. Spanish is the only registered target. To prepare another edition, register its BCP 47 code in `roc_i18n.target_languages` (for example, `pt-BR` for Brazilian Portuguese). Run the same commands with `--language pt-BR` before the operation. Each language has its own queue, reviewed records, and export directory. Register the completed edition in the website language list after its interface and content are translated. Preparing records in the database does not enable a visitor-facing edition.

## Visitor messages and comments

The contact form sends each message to this site’s private Directus Contact Messages collection. Editors can mark a message read and reply using its reply-to address. A Directus item-created flow on this collection can add email notifications later.

Submitted comments are drafts. An editor can change the status to published in Directus. The next site build includes approved comments. Each comment keeps its submitted language. Run `python3 scripts/comment-translations.py pending` to find approved text awaiting translation. For each pending entry, supply `original_language` and the reviewed plain-text `translation`, then run `python3 scripts/comment-translations.py apply reviewed-comments.json` and `python3 scripts/comment-translations.py export` before building. The UI displays an original until its translation is available. Edited originals invalidate their earlier translations.
