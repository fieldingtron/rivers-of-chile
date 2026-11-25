-- Keep immutable originals and the private translation cache separate.
CREATE TABLE IF NOT EXISTS roc_i18n.comment_translations (
    comment_id integer NOT NULL REFERENCES public.roc_comments(id) ON DELETE CASCADE,
    language varchar(35) NOT NULL,
    original_language varchar(35) NOT NULL,
    source_checksum varchar(32) NOT NULL,
    content text NOT NULL,
    PRIMARY KEY (comment_id, language)
);
