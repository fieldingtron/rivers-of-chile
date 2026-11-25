"""List, save, or export approved comment translations. Use the same psql connection as translations.py."""
import argparse
import json
import re
from pathlib import Path
from translations import ROOT, sql

SITE = 'roc'
TABLE = f'{SITE}_i18n.comment_translations'
SOURCE = f'public.{SITE}_comments'

def pending():
    return [json.loads(row) for row in sql(f"""
      SELECT row_to_json(x) FROM (
        SELECT c.id, c.original_language, c.content, md5(c.content) AS source_checksum,
               l.language FROM {SOURCE} c CROSS JOIN (VALUES ('en'),('es')) l(language)
        WHERE c.status='published' AND coalesce(c.content,'')<>'' AND l.language IS DISTINCT FROM coalesce(
          c.original_language, (SELECT t.original_language FROM {TABLE} t WHERE t.comment_id=c.id AND t.source_checksum=md5(c.content) LIMIT 1))
          AND NOT EXISTS (SELECT FROM {TABLE} t WHERE t.comment_id=c.id AND t.language=l.language AND t.source_checksum=md5(c.content))
        ORDER BY c.id,l.language
      ) x;""").splitlines()]

def apply(rows):
    statements = ['BEGIN;', 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;']
    for row in rows:
        if (row['language'] not in ('en','es') or not re.fullmatch('[a-z]{2,3}',row['original_language'])
            or not row['translation'].strip() or row['language']==row['original_language']):
            raise ValueError('Expected a reviewed translation into a different language')
        data = json.dumps(row,ensure_ascii=False).encode().hex()
        statements.append(f"""DO $save$
        DECLARE v jsonb := convert_from(decode('{data}','hex'),'UTF8')::jsonb; parent integer;
        BEGIN
          SELECT id INTO STRICT parent FROM {SOURCE} WHERE id=(v->>'id')::int AND status='published' AND md5(content)=v->>'source_checksum';
          INSERT INTO {TABLE} (comment_id,language,original_language,source_checksum,content)
          VALUES (parent,v->>'language',v->>'original_language',v->>'source_checksum',v->>'translation')
          ON CONFLICT (comment_id,language) DO UPDATE SET source_checksum=excluded.source_checksum, original_language=excluded.original_language,content=excluded.content;
        END $save$;""")
    sql('\n'.join(statements+['COMMIT;']))

def export():
    rows=json.loads(sql(f"""SELECT coalesce(json_agg(row_to_json(x)),'[]') FROM (
      SELECT t.* FROM {TABLE} t JOIN {SOURCE} c ON c.id=t.comment_id WHERE c.status='published' AND md5(c.content)=t.source_checksum
    ) x;"""))
    records={}
    for row in rows:
        record=records.setdefault(row['source_checksum'],{'original':row['original_language'],'translations':{}})
        record['translations'][row['language']]=row['content']
    path=ROOT/'data/comment-translations.json'
    path.with_suffix('.tmp').write_text(json.dumps(records,sort_keys=True,ensure_ascii=False,indent=2)+'\n')
    path.with_suffix('.tmp').replace(path)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='action',required=True)
    sub.add_parser('pending')
    sub.add_parser('apply').add_argument('batch')
    sub.add_parser('export')
    args=parser.parse_args()
    if args.action=='pending': print(json.dumps(pending(),ensure_ascii=False,indent=2))
    elif args.action=='apply': apply(json.loads(Path(args.batch).read_text()))
    else: export()
