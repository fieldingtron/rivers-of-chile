"""Manage reviewed translations via psql. Credentials come from the normal PostgreSQL environment."""
import argparse
import json
import os
import re
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
COMMON = ("title", "content", "seo_title", "seo_description")
ARTICLE_FIELDS = ("excerpt", "put_in", "take_out", "gradient", "season")
ARTICLE_KEYS = ", ".join(f"'{field}'" for field in ARTICLE_FIELDS)
FIELDS = {"pages": COMMON, "posts": COMMON + ARTICLE_FIELDS}
TABLES = {"pages": "roc_i18n.roc_page_translations", "posts": "roc_i18n.roc_post_translations"}


def sql(query):
    result = subprocess.run([os.environ.get("ROC_PSQL", "psql"), "-XqAt", "-v", "ON_ERROR_STOP=1"],
                            input=query, text=True, stdout=subprocess.PIPE, check=True)
    return result.stdout.strip()


def pending(language):
    batch = []
    for kind, fields in FIELDS.items():
        english = f"jsonb_build_object({', '.join(f"'{f}', p.{f}" for f in fields)})"
        if kind == "pages":
            extras = ", ".join(f"'{f}', to_jsonb(p)->'article_data'->>{repr(f)}" for f in ARTICLE_FIELDS)
            english += f" || CASE WHEN p.page_template='roc_article' THEN jsonb_build_object({extras}) ELSE '{{}}'::jsonb END"
        rows = sql(f"""
          SELECT row_to_json(q) FROM (
            SELECT s.kind, s.slug, s.language, s.state, s.source_checksum,
                   {english} AS english
            FROM roc_i18n.translation_status s JOIN public.roc_{kind} p ON p.id=s.parent_id
            WHERE s.kind='{kind}' AND s.language='{language}' AND s.state IN ('missing','changed') ORDER BY s.slug
          ) q;
        """)
        batch.extend(json.loads(line) for line in rows.splitlines())
    print(json.dumps(batch, ensure_ascii=False, indent=2))


def apply(path, language):
    batch = json.loads(Path(path).read_text())
    if not isinstance(batch, list):
        raise ValueError("Expected an array of reviewed translations")
    statements = ["BEGIN;", "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;",
                  "SELECT pg_advisory_xact_lock(hashtext('roc-translations-v1'));"]
    seen = set()
    for row in batch:
        kind, slug = row["kind"], row["slug"]
        if (kind, slug) in seen:
            raise ValueError(f"Duplicate entry: {kind}/{slug}")
        seen.add((kind, slug))
        fields = FIELDS[kind]
        if row.get("language") != language:
            raise ValueError(f"Wrong language for {kind}/{slug}")
        translation = row["translation"]
        allowed_fields = COMMON + ARTICLE_FIELDS
        if (set(translation) - set(allowed_fields) or not all(isinstance(v, str) or v is None for v in translation.values())
                or not translation.get("title") or not isinstance(translation.get("content"), str) or (row.get("english", {}).get("content") and not translation["content"].strip())):
            raise ValueError(f"Invalid translation: {kind}/{slug}")
        data = json.dumps({**translation, "slug": slug, "source_checksum": row["source_checksum"]}, ensure_ascii=False)
        # A hex literal safely transports arbitrary HTML, quotes and Unicode through psql.
        literal = "convert_from(decode('" + data.encode().hex() + "','hex'),'UTF8')::jsonb"
        table = TABLES[kind]
        article_update = ""
        if kind == "pages":
            extras = ", ".join(f"'{f}', v->>{repr(f)}" for f in ARTICLE_FIELDS)
            article_update = f"""
              IF EXISTS (SELECT FROM public.roc_pages WHERE id=source_id AND page_template='roc_article') THEN
                UPDATE {table} SET article_data=jsonb_build_object({extras})
                WHERE parent_id=source_id AND language='{language}';
              ELSIF v ?| ARRAY[{ARTICLE_KEYS}] THEN
                RAISE EXCEPTION 'Unexpected article fields on page %', v->>'slug';
              END IF;
            """
        statements.append(f"""
          DO $save$
          DECLARE v jsonb := {literal}; source_id integer;
          BEGIN
            SELECT parent_id INTO STRICT source_id FROM roc_i18n.translation_status
            WHERE kind='{kind}' AND language='{language}' AND slug=v->>'slug' AND source_checksum=v->>'source_checksum'
                  AND state IN ('missing','changed');
            INSERT INTO {table} (parent_id, language, status, source_checksum, {', '.join(fields)})
            VALUES (source_id, '{language}', 'published', v->>'source_checksum', {', '.join("v->>'"+f+"'" for f in fields)})
            ON CONFLICT (parent_id,language) DO UPDATE SET translated_at=now(), status=excluded.status, source_checksum=excluded.source_checksum,
                  {', '.join(f'{f}=excluded.{f}' for f in fields)};
            {article_update}
          END $save$;
        """)
    sql("\n".join(statements + ["COMMIT;"]))
    print(f"Saved {len(batch)} reviewed translations.")


def export(language):
    directory = ROOT / "data" / language
    directory.mkdir(parents=True, exist_ok=True)
    for kind, fields in FIELDS.items():
        translated = f"jsonb_build_object({', '.join(f"'{f}', t.{f}" for f in fields)})"
        if kind == "pages":
            translated += " || coalesce(nullif(to_jsonb(t)->'article_data', 'null'::jsonb), '{}'::jsonb)"
        result = sql(f"""
          SELECT coalesce(json_object_agg(s.slug, jsonb_strip_nulls({translated}) ORDER BY s.slug), '{{}}')
          FROM roc_i18n.translation_status s
          JOIN {TABLES[kind]} t ON t.parent_id=s.parent_id AND t.language=s.language
          WHERE s.kind='{kind}' AND s.language='{language}' AND s.state='current';
        """)
        translations = json.loads(result)
        with tempfile.NamedTemporaryFile(dir=directory, mode="w", delete=False, encoding="utf-8") as out:
            json.dump(translations, out, indent=2, ensure_ascii=False)
            out.write("\n")
        os.replace(out.name, directory / (kind + ".json"))
        print(f"Exported {len(translations)} {kind}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--language", default="es", help="registered BCP 47 target language, e.g. es")
    operations = parser.add_subparsers(dest="operation", required=True)
    operations.add_parser("pending")
    operations.add_parser("apply").add_argument("batch")
    operations.add_parser("export")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*", args.language):
        parser.error("Invalid language code")
    if sql(f"SELECT code FROM roc_i18n.target_languages WHERE code='{args.language}';") != args.language:
        parser.error("Unregistered translation language")
    if args.operation == "pending":
        pending(args.language)
    elif args.operation == "apply":
        apply(args.batch, args.language)
    else:
        export(args.language)
