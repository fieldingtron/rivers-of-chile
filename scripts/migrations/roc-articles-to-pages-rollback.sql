\set ON_ERROR_STOP on
\if :{?roc_commit}
\else
\set roc_commit false
\endif

BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(hashtext('roc-translations-v1'));
LOCK TABLE public.roc_posts, public.roc_pages, public.roc_comments,
    public.roc_posts_files, public.directus_fields, public.directus_presets,
    public.directus_comments, public.directus_shares, public.directus_versions,
    roc_i18n.roc_post_translations, roc_i18n.roc_page_translations
    IN SHARE ROW EXCLUSIVE MODE;

DO $preflight$
BEGIN
    IF EXISTS (
        SELECT FROM roc_article_cutover.pages_after b
        LEFT JOIN public.roc_pages q USING (id)
        WHERE to_jsonb(q) IS DISTINCT FROM to_jsonb(b)
    ) OR EXISTS (
        (SELECT t.* FROM roc_i18n.roc_page_translations t JOIN roc_article_cutover.targets m ON m.page_id = t.parent_id
         EXCEPT SELECT * FROM roc_article_cutover.translations_after)
        UNION ALL
        (SELECT * FROM roc_article_cutover.translations_after
         EXCEPT SELECT t.* FROM roc_i18n.roc_page_translations t JOIN roc_article_cutover.targets m ON m.page_id = t.parent_id)
    ) OR EXISTS (
        SELECT FROM public.roc_pages q LEFT JOIN roc_article_cutover.targets m ON m.page_id = q.id
        WHERE m.page_id IS NULL AND (q.article_data IS NOT NULL OR q.page_template = 'roc_article')
    ) OR EXISTS (
        SELECT FROM roc_i18n.roc_page_translations t LEFT JOIN roc_article_cutover.targets m ON m.page_id = t.parent_id
        WHERE m.page_id IS NULL AND t.article_data IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Article or translation changes require reconciliation before rollback';
    END IF;
    IF EXISTS (
        SELECT FROM public.directus_comments c JOIN roc_article_cutover.targets m ON c.item = m.page_id::text
        WHERE c.collection = 'roc_pages'
    ) OR EXISTS (
        SELECT FROM public.directus_shares s JOIN roc_article_cutover.targets m ON s.item = m.page_id::text
        WHERE s.collection = 'roc_pages'
    ) OR EXISTS (
        SELECT FROM public.directus_versions v JOIN roc_article_cutover.targets m ON v.item = m.page_id::text
        WHERE v.collection = 'roc_pages'
    ) THEN
        RAISE EXCEPTION 'New Studio comments, shares, or versions require explicit rollback handling';
    END IF;
    IF EXISTS (
        SELECT FROM pg_constraint c
        WHERE c.contype = 'f' AND c.confrelid = 'public.roc_pages'::regclass
          AND NOT EXISTS (
              SELECT FROM pg_attribute f WHERE f.attrelid = c.conrelid AND c.conkey = ARRAY[f.attnum]
                AND (c.conrelid, f.attname::text) IN (
                    ('public.roc_comments'::regclass, 'page'),
                    ('roc_i18n.roc_page_translations'::regclass, 'parent_id')
                )
          )
    ) THEN
        RAISE EXCEPTION 'Unmapped foreign key references roc_pages';
    END IF;
    IF EXISTS (
        SELECT FROM public.roc_posts p JOIN roc_article_cutover.posts b
          ON p.id = b.id OR p.slug = b.slug OR p.wp_id = b.wp_id
    ) OR EXISTS (
        SELECT FROM public.roc_comments c JOIN roc_article_cutover.targets m ON m.page_id = c.page
        WHERE c.post IS NOT NULL
    ) OR EXISTS (
        SELECT FROM public.roc_posts_files g JOIN roc_article_cutover.gallery b USING (id)
    ) OR EXISTS (
        SELECT FROM public.directus_presets p JOIN roc_article_cutover.bookmarks b
          ON p.id = b.id OR (p.collection = b.collection AND p.bookmark = b.bookmark
                             AND p.role IS NOT DISTINCT FROM b.role AND p."user" IS NOT DISTINCT FROM b."user")
    ) THEN
        RAISE EXCEPTION 'Rollback identity, comment-target or bookmark collision';
    END IF;
END
$preflight$;

DROP TRIGGER roc_route_article_comment ON public.roc_comments;
DROP FUNCTION roc_article_cutover.route_comment();
ALTER TABLE public.roc_posts DROP CONSTRAINT roc_posts_river_only;
ALTER TABLE public.roc_posts DROP CONSTRAINT roc_posts_moved_article_ids_reserved;
DO $kind_default$
DECLARE old_default text;
BEGIN
    SELECT expression INTO old_default FROM roc_article_cutover.kind_default;
    IF old_default IS NULL THEN
        ALTER TABLE public.roc_posts ALTER COLUMN kind DROP DEFAULT;
    ELSE
        EXECUTE 'ALTER TABLE public.roc_posts ALTER COLUMN kind SET DEFAULT ' || old_default;
    END IF;
END
$kind_default$;

INSERT INTO public.roc_posts SELECT * FROM roc_article_cutover.posts;
INSERT INTO roc_i18n.roc_post_translations SELECT * FROM roc_article_cutover.translations;
INSERT INTO public.roc_posts_files SELECT * FROM roc_article_cutover.gallery;

CREATE TEMP TABLE rollback_comments ON COMMIT DROP AS
SELECT c.id, m.post_id FROM public.roc_comments c JOIN roc_article_cutover.targets m ON c.page = m.page_id;
UPDATE public.roc_comments c SET post = b.post_id, page = NULL
FROM rollback_comments b WHERE c.id = b.id;
DELETE FROM public.roc_pages q USING roc_article_cutover.targets m WHERE q.id = m.page_id;

CREATE OR REPLACE VIEW roc_i18n.sources AS
SELECT 'posts'::text AS kind, id AS parent_id, slug,
       md5(jsonb_build_array(title, content, excerpt, seo_title, seo_description, put_in, take_out, gradient, season)::text) AS source_checksum
FROM public.roc_posts WHERE status = 'published'
UNION ALL
SELECT 'pages', id, slug, md5(jsonb_build_array(title, content, seo_title, seo_description)::text)
FROM public.roc_pages WHERE status = 'published';

ALTER TABLE roc_i18n.roc_page_translations DROP COLUMN article_data;
ALTER TABLE public.roc_pages DROP COLUMN article_data;
DELETE FROM public.directus_fields WHERE collection = 'roc_pages' AND field = 'article_data';

UPDATE public.directus_fields SET hidden = b.hidden FROM roc_article_cutover.field_settings b
WHERE collection = 'roc_posts' AND field = 'kind';
INSERT INTO public.directus_presets SELECT * FROM roc_article_cutover.bookmarks;

DO $verify$
BEGIN
    IF EXISTS (
        SELECT FROM roc_article_cutover.posts b
        LEFT JOIN public.roc_posts p USING (id) WHERE to_jsonb(p) IS DISTINCT FROM to_jsonb(b)
    ) OR EXISTS (
        SELECT FROM roc_article_cutover.translations b
        LEFT JOIN roc_i18n.roc_post_translations t USING (id) WHERE to_jsonb(t) IS DISTINCT FROM to_jsonb(b)
    ) OR EXISTS (
        SELECT FROM rollback_comments b LEFT JOIN public.roc_comments c USING (id)
        WHERE c.post IS DISTINCT FROM b.post_id OR c.page IS NOT NULL
    ) OR EXISTS (
        SELECT FROM roc_article_cutover.gallery b
        LEFT JOIN public.roc_posts_files g USING (id) WHERE to_jsonb(g) IS DISTINCT FROM to_jsonb(b)
    ) OR EXISTS (
        SELECT FROM roc_article_cutover.targets m JOIN public.roc_pages q ON q.id = m.page_id
    ) THEN
        RAISE EXCEPTION 'Rollback postconditions failed';
    END IF;
END
$verify$;

SELECT slug, post_id AS restored_post_id FROM roc_article_cutover.targets ORDER BY slug;
-- Preserve the private journal after rollback, including the allocated page IDs.
DO $archive$
BEGIN
    EXECUTE format('ALTER SCHEMA roc_article_cutover RENAME TO %I',
        'roc_article_cutover_rollback_' || pg_current_xact_id()::text);
END
$archive$;

\if :roc_commit
COMMIT;
\else
ROLLBACK;
\endif
