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

CREATE SCHEMA roc_article_cutover;
REVOKE ALL ON SCHEMA roc_article_cutover FROM PUBLIC;

CREATE TEMP TABLE article_ids (post_id integer PRIMARY KEY, slug text UNIQUE NOT NULL) ON COMMIT DROP;
-- These are also the IDs published in the current /comment-targets.json.
INSERT INTO article_ids VALUES (9, 'futaleufu-riverkeeper'), (11, 'whitewater-grand-prix'),
    (35, 'cancel-hidroaysen'), (47, 'nublefest-2010-in-chile'), (48, 'flying-to-chile-with-kayaks-2011');

DO $preflight$
BEGIN
    IF (SELECT count(*) FROM public.roc_posts WHERE kind IS DISTINCT FROM 'river') <> 5
        OR EXISTS (
            SELECT FROM article_ids a LEFT JOIN public.roc_posts p ON p.id = a.post_id
            WHERE p.slug IS DISTINCT FROM a.slug OR p.kind IS DISTINCT FROM 'article'
                OR p.status IS DISTINCT FROM 'published'
        ) THEN
        RAISE EXCEPTION 'Expected exactly the five known published article IDs and slugs';
    END IF;
    IF EXISTS (
        SELECT FROM public.roc_pages q JOIN public.roc_posts p ON q.slug = p.slug OR q.wp_id = p.wp_id
        JOIN article_ids a ON p.id = a.post_id
    ) OR EXISTS (SELECT FROM public.roc_pages WHERE page_template = 'roc_article') THEN
        RAISE EXCEPTION 'Article slug, WordPress ID, or page-template collision';
    END IF;
    IF EXISTS (
        SELECT FROM pg_constraint c
        JOIN pg_attribute f ON f.attrelid = c.conrelid AND c.conkey = ARRAY[f.attnum]
        WHERE c.contype = 'f' AND c.confrelid = 'public.roc_posts'::regclass
          AND (c.conrelid, f.attname::text) NOT IN (
            ('public.roc_comments'::regclass, 'post'),
            ('roc_i18n.roc_post_translations'::regclass, 'parent_id'),
            ('public.roc_posts_files'::regclass, 'roc_posts_id')
          )
    ) OR EXISTS (
        SELECT FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.roc_posts'::regclass
          AND cardinality(conkey) <> 1
    ) THEN
        RAISE EXCEPTION 'Unmapped foreign key references roc_posts';
    END IF;
    IF EXISTS (
        SELECT FROM public.roc_posts p JOIN article_ids a ON p.id = a.post_id
        JOIN public.roc_posts_files g ON g.roc_posts_id = p.id
        GROUP BY p.id HAVING count(*) <> 1 OR bool_or(
            g.directus_files_id IS NULL OR g.directus_files_id IS DISTINCT FROM p.featured_image
        )
    ) THEN
        RAISE EXCEPTION 'An article has gallery media beyond its featured image';
    END IF;
    IF EXISTS (
        SELECT FROM public.directus_comments c JOIN article_ids a ON c.item = a.post_id::text
        WHERE c.collection = 'roc_posts'
    ) OR EXISTS (
        SELECT FROM public.directus_shares s JOIN article_ids a ON s.item = a.post_id::text
        WHERE s.collection = 'roc_posts'
    ) OR EXISTS (
        SELECT FROM public.directus_versions v JOIN article_ids a ON v.item = a.post_id::text
        WHERE v.collection = 'roc_posts'
    ) THEN
        RAISE EXCEPTION 'Studio comments, shares, or versions require explicit migration handling';
    END IF;
    IF EXISTS (
        SELECT FROM public.roc_comments c JOIN article_ids a ON a.post_id = c.post
        WHERE c.page IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'A comment already has two targets';
    END IF;
    IF EXISTS (
        SELECT FROM article_ids a LEFT JOIN roc_i18n.translation_status s
          ON s.kind = 'posts' AND s.parent_id = a.post_id AND s.language = 'es'
        LEFT JOIN roc_i18n.roc_post_translations t ON t.parent_id = a.post_id AND t.language = 'es'
        WHERE s.state IS NULL OR s.state NOT IN ('current', 'changed') OR t.status IS DISTINCT FROM 'published'
    ) THEN
        RAISE EXCEPTION 'Expected an existing reviewed Spanish translation for all five articles';
    END IF;
END
$preflight$;

-- Keep backup records in a private schema, including source checksums and editor metadata.
CREATE TABLE roc_article_cutover.posts AS
SELECT p.* FROM public.roc_posts p JOIN article_ids a ON p.id = a.post_id;
CREATE TABLE roc_article_cutover.translations AS
SELECT t.* FROM roc_i18n.roc_post_translations t JOIN article_ids a ON t.parent_id = a.post_id;
CREATE TABLE roc_article_cutover.comment_targets AS
SELECT c.id, c.post, c.page FROM public.roc_comments c JOIN article_ids a ON c.post = a.post_id;
CREATE TABLE roc_article_cutover.gallery AS
SELECT g.* FROM public.roc_posts_files g JOIN article_ids a ON g.roc_posts_id = a.post_id;
CREATE TABLE roc_article_cutover.translation_states AS
SELECT t.* FROM roc_i18n.translation_status t JOIN article_ids a ON t.parent_id = a.post_id WHERE t.kind = 'posts';
CREATE TABLE roc_article_cutover.field_settings AS
SELECT hidden FROM public.directus_fields WHERE collection = 'roc_posts' AND field = 'kind';
CREATE TABLE roc_article_cutover.kind_default AS
SELECT pg_get_expr(d.adbin, d.adrelid) AS expression FROM pg_attrdef d
JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
WHERE d.adrelid = 'public.roc_posts'::regclass AND a.attname = 'kind';
CREATE TABLE roc_article_cutover.bookmarks AS
SELECT * FROM public.directus_presets WHERE collection = 'roc_posts' AND id IN (33, 34)
    AND bookmark IN ('ROC Rivers', 'ROC Articles');

ALTER TABLE public.roc_pages ADD COLUMN article_data jsonb;
ALTER TABLE roc_i18n.roc_page_translations ADD COLUMN article_data jsonb;
INSERT INTO public.directus_fields (collection, field, hidden, readonly)
VALUES ('roc_pages', 'article_data', true, true);

INSERT INTO public.roc_pages (
    wp_id, status, title, slug, content, page_template, seo_title, seo_description,
    published_at, updated_at, author_wp_id, featured_image, article_data
)
SELECT wp_id, status, title, slug, content, 'roc_article', seo_title, seo_description,
    published_at, updated_at, author_wp_id, featured_image,
    to_jsonb(p) - ARRAY[
        'wp_id', 'status', 'title', 'slug', 'content', 'seo_title', 'seo_description',
        'published_at', 'updated_at', 'author_wp_id', 'featured_image', 'kind'
    ]
FROM roc_article_cutover.posts p;

CREATE TABLE roc_article_cutover.targets (
    post_id integer PRIMARY KEY, page_id integer NOT NULL UNIQUE, slug text NOT NULL UNIQUE
);
INSERT INTO roc_article_cutover.targets
SELECT a.post_id, q.id, a.slug FROM article_ids a JOIN public.roc_pages q USING (slug);

INSERT INTO roc_i18n.roc_page_translations (
    parent_id, language, status, title, content, seo_title, seo_description,
    source_checksum, translated_at, article_data
)
SELECT m.page_id, t.language, t.status, t.title, t.content, t.seo_title, t.seo_description,
    t.source_checksum, t.translated_at,
    jsonb_build_object('excerpt', t.excerpt, 'put_in', t.put_in, 'take_out', t.take_out,
                       'gradient', t.gradient, 'season', t.season)
FROM roc_article_cutover.translations t JOIN roc_article_cutover.targets m ON m.post_id = t.parent_id;

-- Moved articles keep the exact checksum inputs used for their reviewed translations.
CREATE OR REPLACE VIEW roc_i18n.sources AS
SELECT 'posts'::text AS kind, id AS parent_id, slug,
       md5(jsonb_build_array(title, content, excerpt, seo_title, seo_description, put_in, take_out, gradient, season)::text) AS source_checksum
FROM public.roc_posts WHERE status = 'published'
UNION ALL
SELECT 'pages', id, slug,
       CASE WHEN page_template = 'roc_article' THEN md5(jsonb_build_array(
           title, content, article_data->>'excerpt', seo_title, seo_description, article_data->>'put_in',
           article_data->>'take_out', article_data->>'gradient', article_data->>'season')::text)
       ELSE md5(jsonb_build_array(title, content, seo_title, seo_description)::text) END
FROM public.roc_pages WHERE status = 'published';

UPDATE public.roc_comments c SET page = m.page_id, post = NULL
FROM roc_article_cutover.targets m WHERE c.post = m.post_id;

-- Existing and rebuilt site exports can still submit the original post ID.
CREATE FUNCTION roc_article_cutover.route_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $route$
DECLARE target_page integer;
BEGIN
    IF NEW.post IS NOT NULL AND NEW.page IS NULL THEN
        SELECT page_id INTO target_page FROM roc_article_cutover.targets WHERE post_id = NEW.post;
        IF FOUND THEN
            NEW.page := target_page;
            NEW.post := NULL;
        END IF;
    END IF;
    RETURN NEW;
END
$route$;
REVOKE ALL ON FUNCTION roc_article_cutover.route_comment() FROM PUBLIC;
CREATE TRIGGER roc_route_article_comment BEFORE INSERT OR UPDATE OF post, page ON public.roc_comments
FOR EACH ROW EXECUTE FUNCTION roc_article_cutover.route_comment();

DELETE FROM public.roc_posts p USING article_ids a WHERE p.id = a.post_id;
UPDATE public.directus_fields SET hidden = true WHERE collection = 'roc_posts' AND field = 'kind';
ALTER TABLE public.roc_posts ALTER COLUMN kind SET DEFAULT 'river';
ALTER TABLE public.roc_posts ADD CONSTRAINT roc_posts_river_only CHECK (kind IS NOT DISTINCT FROM 'river');
ALTER TABLE public.roc_posts ADD CONSTRAINT roc_posts_moved_article_ids_reserved CHECK (id NOT IN (9, 11, 35, 47, 48));

DELETE FROM public.directus_presets p USING roc_article_cutover.bookmarks b WHERE p.id = b.id;

CREATE TABLE roc_article_cutover.pages_after AS
SELECT q.* FROM public.roc_pages q JOIN roc_article_cutover.targets m ON q.id = m.page_id;
CREATE TABLE roc_article_cutover.translations_after AS
SELECT t.* FROM roc_i18n.roc_page_translations t JOIN roc_article_cutover.targets m ON t.parent_id = m.page_id;

DO $verify$
BEGIN
    IF (SELECT count(*) FROM roc_article_cutover.pages_after) <> 5
        OR (SELECT count(*) FROM roc_article_cutover.field_settings) <> 1
        OR (SELECT count(*) FROM roc_article_cutover.bookmarks) <> 2
        OR EXISTS (SELECT FROM public.roc_posts JOIN article_ids USING (slug))
        OR EXISTS (
            SELECT FROM roc_article_cutover.gallery g
            JOIN roc_article_cutover.targets m ON m.post_id = g.roc_posts_id
            JOIN roc_article_cutover.pages_after q ON q.id = m.page_id
            WHERE q.featured_image IS DISTINCT FROM g.directus_files_id
        )
        OR EXISTS (
            SELECT FROM roc_article_cutover.translation_states s
            JOIN roc_article_cutover.targets m ON m.post_id = s.parent_id
            LEFT JOIN roc_i18n.translation_status t ON t.kind = 'pages' AND t.parent_id = m.page_id AND t.language = s.language
            WHERE (s.source_checksum, s.translated_checksum, s.state)
                IS DISTINCT FROM (t.source_checksum, t.translated_checksum, t.state)
        )
        OR EXISTS (
            SELECT FROM roc_article_cutover.comment_targets b
            JOIN roc_article_cutover.targets m ON m.post_id = b.post
            LEFT JOIN public.roc_comments c ON c.id = b.id
            WHERE c.page IS DISTINCT FROM m.page_id OR c.post IS NOT NULL
        )
        OR EXISTS (
            SELECT FROM roc_article_cutover.posts p
            JOIN roc_article_cutover.pages_after q USING (slug)
            WHERE to_jsonb(p) - 'kind' IS DISTINCT FROM
                ((to_jsonb(q) - 'id') - ARRAY(
                    SELECT key FROM jsonb_object_keys(to_jsonb(q)) AS key WHERE NOT (to_jsonb(p) ? key)
                )) || q.article_data
        ) THEN
        RAISE EXCEPTION 'Migration postconditions failed';
    END IF;
END
$verify$;

SELECT m.slug, m.post_id, m.page_id, q.status,
    (SELECT count(*) FROM public.roc_comments c WHERE c.page = m.page_id) AS comments,
    (SELECT state FROM roc_i18n.translation_status t
     WHERE t.kind = 'pages' AND t.parent_id = m.page_id AND t.language = 'es') AS spanish
FROM roc_article_cutover.targets m JOIN public.roc_pages q ON q.id = m.page_id ORDER BY m.slug;

\if :roc_commit
COMMIT;
\else
ROLLBACK;
\endif
