# Rivers of Chile article move

The Directus API key for ROC Rivers remains `roc_posts`. These five articles move to existing `roc_pages` records with the same public slugs, original WordPress IDs, status, text, SEO, dates, author and featured file references. The operation creates new page IDs because page and post IDs are allocated separately and can overlap. The private journal records both IDs.

| Slug | Existing post ID |
| --- | ---: |
| `futaleufu-riverkeeper` | 9 |
| `whitewater-grand-prix` | 11 |
| `cancel-hidroaysen` | 35 |
| `nublefest-2010-in-chile` | 47 |
| `flying-to-chile-with-kayaks-2011` | 48 |

The compatibility release reads either layout and renders the moved pages with the existing article template. It uses page translations once exported and accepts existing post translation exports during the release transition. The database maps prior comment targets to the new page IDs, so both cached and newly built comment forms retain the existing public target IDs. The comment rows keep their own IDs and translation associations. Each article's hidden gallery contains one copy of its featured file. ROC Pages retains that file as its editable featured image and the private journal retains the exact old gallery row. The transaction hides Kind in Directus, defaults new river records to `river`, and removes the two temporary bookmarks. Dropping the physical column is a separate step after the rollback window.

## Release order

1. Obtain authorization for the compatibility release. Commit and publish only its files through the existing Chile workflow, which builds from the current main branch. Confirm the attempt succeeded, the ten English and Spanish article URLs render, and the five published comment targets match the table above. Ensure older builds cannot publish over the compatibility release.
2. With a verified database connection, take a private PostgreSQL backup and restore it in an isolated environment. Use the SQL scripts below against that restore first. The forward migration refuses collisions, unknown referencing foreign keys, gallery media beyond the featured file, Studio comments, shares or content versions on the five items, ambiguous visitor comment targets, and missing reviewed Spanish translations. A stale translation retains its text, original checksum and review state. Confirm the gallery and relation metadata and the actual Editor, Build and Visitor policies. The build user must receive `roc_pages.article_data` under its existing published-page read rule. Test that the form user keeps its existing create access for both visitor-comment targets. Stop and resolve any failed precondition before applying.
3. Hold edits to the five articles and their translations during verification. Apply the forward transaction to the verified live database. Its private journal keeps the full original post and translation rows, the original comment targets, the ID map, metadata settings and bookmark records. Use an authorized Directus administrator to refresh the affected cache using Directus's system cache clear endpoint, `POST /utils/cache/clear?system`. Verify the actual collection link shows rivers only without bookmarks, the five slugs appear in ROC Pages and Kind is absent from the river form. Test the published-only API and a private or staging visitor-comment submission through the old target mapping. The tagged Directus sidebar has no pin action for the collection itself.
4. Build and check with an authorized read-only live token and the existing Spanish export. Verify all ten article routes, their structured data, comments and featured files, the sitemap, and a control river and page. Direct SQL bypasses Directus item flows, so verify the expected publisher job ran.
5. Futaleufú RiverKeeper was already flagged `changed` before cutover. Keep the existing Spanish export through its translation review. The exporter excludes rows flagged `changed`. Once the review is published, export with `python3 scripts/translations.py export`, verify all five Spanish keys in the page export, and release the reviewed export through the authorized Chile workflow.

Both SQL files default to a rolled-back rehearsal. Rehearse against a restored database because sequence increments survive rolled-back transactions. Commit explicitly only after the compatibility release has been verified and the production backup is usable.

```sh
psql -X -f scripts/migrations/roc-articles-to-pages.sql
psql -X -v roc_commit=true -f scripts/migrations/roc-articles-to-pages.sql
psql -X -v roc_commit=true -f scripts/migrations/roc-articles-to-pages-rollback.sql
```

Rollback restores original posts, translations, field settings and bookmarks, and remaps visitor comments submitted during the cutover. It refuses to overwrite article or translation edits and preserves the private journal under a transaction-specific schema name. Refresh the Directus cache and regenerate the Spanish export after rollback if the post-cutover export was already released. Keep the physical Kind column through the rollback window. Before dropping it, audit all publisher and importer versions and any Directus presets, validations and flows that reference it.
