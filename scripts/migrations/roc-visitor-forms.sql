BEGIN;
CREATE TABLE IF NOT EXISTS public.roc_contact_messages (
    id serial PRIMARY KEY, received_at timestamptz NOT NULL DEFAULT now(), status varchar(16) NOT NULL DEFAULT 'unread',
    sender_name varchar(100) NOT NULL, reply_to varchar(254) NOT NULL, subject varchar(150), message text NOT NULL, language varchar(8) NOT NULL
);
ALTER TABLE public.roc_comments ADD COLUMN IF NOT EXISTS original_language varchar(8);
INSERT INTO directus_collections (collection,icon,note,display_template,"group")
VALUES ('roc_contact_messages','inbox','Private visitor messages. Use the reply-to address to respond.', '{{sender_name}} — {{subject}}','rivers_of_chile') ON CONFLICT DO NOTHING;
INSERT INTO directus_fields (collection,field,interface,options,readonly) SELECT 'roc_contact_messages',v.field,v.interface,v.options::json,v.readonly FROM (VALUES
('status','select-dropdown','{"choices":[{"text":"Unread","value":"unread"},{"text":"Read","value":"read"},{"text":"Archived","value":"archived"}]}',false),
('received_at','datetime',null,true),('sender_name','input',null,true),('reply_to','input',null,true),('subject','input',null,true),('message','input-multiline',null,true),('language','input',null,true)
) v(field,interface,options,readonly) WHERE NOT EXISTS (SELECT FROM directus_fields f WHERE f.collection='roc_contact_messages' AND f.field=v.field);
INSERT INTO directus_fields(collection,field,interface) SELECT 'roc_comments','original_language','input' WHERE NOT EXISTS (SELECT FROM directus_fields WHERE collection='roc_comments' AND field='original_language');
INSERT INTO directus_policies(id,name,icon,description) SELECT gen_random_uuid(),'roc-public-form-writer','edit_note','Create-only website form submissions.' WHERE NOT EXISTS (SELECT FROM directus_policies WHERE name='roc-public-form-writer');
INSERT INTO directus_permissions(policy,collection,action,fields,permissions,presets,validation)
SELECT p.id,v.collection,v.action,v.fields,'{}'::json,v.presets::json,v.validation::json FROM directus_policies p CROSS JOIN (VALUES
('roc_comments','create','author_name,content,post,page,original_language','{"status":"draft"}','{"status":{"_eq":"draft"}}'),
('roc_contact_messages','create','sender_name,reply_to,subject,message,language','{"status":"unread"}','{"status":{"_eq":"unread"}}')
) v(collection,action,fields,presets,validation) WHERE p.name='roc-public-form-writer' AND NOT EXISTS (SELECT FROM directus_permissions d WHERE d.collection=v.collection AND d.policy=p.id AND d.action=v.action);
INSERT INTO directus_permissions(policy,collection,action,fields,permissions)
SELECT p.id,'roc_contact_messages',v.action,v.fields,'{}'::json FROM directus_policies p CROSS JOIN (VALUES ('read','*'),('update','status')) v(action,fields)
WHERE p.name='River Sites Editor' AND NOT EXISTS(SELECT FROM directus_permissions d WHERE d.policy=p.id AND d.collection='roc_contact_messages' AND d.action=v.action);
UPDATE directus_permissions d SET fields=concat_ws(',',fields,'original_language') FROM directus_policies p WHERE d.policy=p.id AND p.name='River Sites Editor' AND d.collection='roc_comments' AND d.action='read' AND fields<>'*' AND 'original_language'<>ALL(string_to_array(fields,','));
COMMIT;
