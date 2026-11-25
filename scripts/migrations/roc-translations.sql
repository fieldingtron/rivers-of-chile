-- Existing roc_posts and roc_pages hold English and language-independent facts.
-- Apply to the Directus PostgreSQL database. No changes to existing content.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('roc-translations-v1'));

CREATE SCHEMA IF NOT EXISTS roc_i18n;
REVOKE ALL ON SCHEMA roc_i18n FROM PUBLIC;

-- Register a target locale here when work on that language begins.
CREATE TABLE IF NOT EXISTS roc_i18n.target_languages (
    code varchar(35) PRIMARY KEY CHECK (code ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$' AND code <> 'en')
);
INSERT INTO roc_i18n.target_languages VALUES ('es') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS roc_i18n.roc_post_translations (
    id serial PRIMARY KEY,
    parent_id integer NOT NULL REFERENCES public.roc_posts(id) ON DELETE CASCADE,
    language varchar(35) NOT NULL REFERENCES roc_i18n.target_languages(code),
    status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    title text NOT NULL, content text NOT NULL, excerpt text,
    seo_title text, seo_description text, put_in text, take_out text, gradient text, season text,
    source_checksum varchar(32),
    translated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (parent_id, language)
);
CREATE TABLE IF NOT EXISTS roc_i18n.roc_page_translations (
    id serial PRIMARY KEY,
    parent_id integer NOT NULL REFERENCES public.roc_pages(id) ON DELETE CASCADE,
    language varchar(35) NOT NULL REFERENCES roc_i18n.target_languages(code),
    status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    title text NOT NULL, content text NOT NULL, seo_title text, seo_description text,
    source_checksum varchar(32),
    translated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (parent_id, language)
);


-- Hash only translated fields. JSON distinguishes null, empty strings, and field boundaries.
CREATE OR REPLACE VIEW roc_i18n.sources AS
SELECT 'posts'::text AS kind, id AS parent_id, slug,
       md5(jsonb_build_array(title, content, excerpt, seo_title, seo_description, put_in, take_out, gradient, season)::text) AS source_checksum
FROM public.roc_posts WHERE status='published'
UNION ALL
SELECT 'pages', id, slug, md5(jsonb_build_array(title, content, seo_title, seo_description)::text)
FROM public.roc_pages WHERE status='published';

CREATE OR REPLACE VIEW roc_i18n.translation_status AS
SELECT s.*, t.source_checksum AS translated_checksum,
       CASE WHEN t.parent_id IS NULL THEN 'missing'
            WHEN t.source_checksum IS DISTINCT FROM s.source_checksum THEN 'changed'
            WHEN t.status <> 'published' THEN t.status ELSE 'current' END AS state, l.code AS language
FROM roc_i18n.sources s CROSS JOIN roc_i18n.target_languages l
LEFT JOIN (
    SELECT 'posts'::text AS kind, parent_id, source_checksum, status, language FROM roc_i18n.roc_post_translations
    UNION ALL
    SELECT 'pages', parent_id, source_checksum, status, language FROM roc_i18n.roc_page_translations
) t ON t.kind=s.kind AND t.parent_id=s.parent_id AND t.language=l.code;
COMMIT;
