#!/usr/bin/env node
/**
 * Create roc_* collections, a read-only build role/policy, and a static token.
 * Reads DIRECTUS_ADMIN_TOKEN from the environment. Never prints secret values.
 * The build token is written to /workspace/roc/.directus_build_token (mode 0600).
 *
 * Does not modify vpnreviewz_* collections, roles, or policies.
 * Safe to re-run (skips existing roc_* collections / role / policy).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_URL = 'https://content.fieldsmarshall.com';
const TOKEN_FILE = '/workspace/roc/.directus_build_token';
const COLLECTIONS = [
  'roc_authors',
  'roc_media',
  'roc_regions',
  'roc_categories',
  'roc_tags',
  'roc_posts',
  'roc_pages',
  'roc_redirects',
  'roc_site'
];

function requireAdminToken() {
  const token = process.env.DIRECTUS_ADMIN_TOKEN?.trim();
  if (!token) {
    throw new Error('DIRECTUS_ADMIN_TOKEN is required. Set it in the environment. Do not paste it into chat.');
  }
  return token;
}

function directusUrl() {
  const raw = process.env.DIRECTUS_URL?.trim() || DEFAULT_URL;
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('DIRECTUS_URL must be an HTTPS origin without embedded credentials.');
  }
  return url.origin;
}

async function api(method, pathname, body) {
  const url = new URL(pathname, directusUrl());
  const res = await fetch(url, {
    method,
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${requireAdminToken()}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    let code = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      const first = err?.errors?.[0];
      if (first?.extensions?.code) code += ` ${first.extensions.code}`;
      if (first?.message) code += ` (${String(first.message).slice(0, 180)})`;
    } catch {
      // Do not log bodies that fail to parse.
    }
    throw new Error(`Directus ${method} ${pathname} failed: ${code}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function field(name, type, meta = {}, schema = {}) {
  return {
    field: name,
    type,
    meta: { interface: meta.interface || (type === 'text' ? 'input-multiline' : 'input'), width: meta.width || 'full', ...meta },
    schema
  };
}

const ID_FIELD = {
  field: 'id',
  type: 'integer',
  meta: { hidden: true, interface: 'numeric', readonly: true },
  schema: { is_primary_key: true, has_auto_increment: true }
};

function collections() {
  const status = field('status', 'string', { interface: 'select-dropdown', options: { choices: [
    { text: 'Published', value: 'published' },
    { text: 'Draft', value: 'draft' },
    { text: 'Archived', value: 'archived' }
  ] } }, { default_value: 'draft' });

  return [
    {
      collection: 'roc_authors',
      meta: { icon: 'person', display_template: '{{name}}' },
      schema: {},
      fields: [
        field('wp_user_id', 'integer', { interface: 'input' }, { is_unique: true }),
        status,
        field('name', 'string', { required: true }),
        field('slug', 'string', { interface: 'input' }, { is_unique: true }),
        field('bio', 'text')
      ]
    },
    {
      collection: 'roc_media',
      meta: { icon: 'image', display_template: '{{filename}}' },
      schema: {},
      fields: [
        field('wp_id', 'integer', { interface: 'input' }, { is_unique: true }),
        field('status', 'string', { interface: 'select-dropdown', options: { choices: [
          { text: 'Pending', value: 'pending' },
          { text: 'Uploaded', value: 'uploaded' },
          { text: 'Missing', value: 'missing' }
        ] } }, { default_value: 'pending' }),
        field('source_url', 'text'),
        field('filename', 'string'),
        field('mime', 'string'),
        field('bytes', 'bigInteger', { interface: 'input' }),
        field('width', 'integer'),
        field('height', 'integer'),
        field('alt', 'string'),
        field('caption', 'text'),
        field('attached_to_wp_id', 'integer'),
        field('sha256', 'string'),
        field('r2_key', 'string'),
        field('variants', 'json', { interface: 'input-code', options: { language: 'json' } }),
        field('referenced', 'boolean', { interface: 'boolean' }, { default_value: false })
      ]
    },
    {
      collection: 'roc_regions',
      meta: { icon: 'map', display_template: '{{name}}' },
      schema: {},
      fields: [
        field('slug', 'string', {}, { is_unique: true }),
        field('name', 'string', { required: true }),
        field('roman', 'string'),
        field('sort', 'integer')
      ]
    },
    {
      collection: 'roc_categories',
      meta: { icon: 'folder', display_template: '{{name}}' },
      schema: {},
      fields: [
        field('wp_id', 'integer', {}, { is_unique: true }),
        status,
        field('slug', 'string', {}, { is_unique: true }),
        field('name', 'string', { required: true }),
        field('type', 'string', { interface: 'select-dropdown', options: { choices: [
          { text: 'Class', value: 'class' },
          { text: 'Region', value: 'region' },
          { text: 'Topic', value: 'topic' },
          { text: 'Country', value: 'country' },
          { text: 'News', value: 'news' }
        ] } }),
        field('parent_wp_id', 'integer'),
        field('count', 'integer')
      ]
    },
    {
      collection: 'roc_tags',
      meta: { icon: 'label', display_template: '{{name}}' },
      schema: {},
      fields: [
        field('wp_id', 'integer', {}, { is_unique: true }),
        status,
        field('slug', 'string', {}, { is_unique: true }),
        field('name', 'string', { required: true }),
        field('count', 'integer')
      ]
    },
    {
      collection: 'roc_posts',
      meta: { icon: 'article', display_template: '{{title}}' },
      schema: {},
      fields: [
        field('wp_id', 'integer', {}, { is_unique: true }),
        status,
        field('kind', 'string', { interface: 'select-dropdown', options: { choices: [
          { text: 'River', value: 'river' },
          { text: 'News', value: 'news' },
          { text: 'Article', value: 'article' }
        ] } }),
        field('title', 'string', { required: true }),
        field('slug', 'string', { required: true }, { is_unique: true }),
        field('content', 'text', { interface: 'input-rich-text-html' }),
        field('excerpt', 'text'),
        field('published_at', 'dateTime', { interface: 'datetime' }),
        field('updated_at', 'dateTime', { interface: 'datetime' }),
        field('author_wp_id', 'integer'),
        field('author_name', 'string'),
        field('author_slug', 'string'),
        field('featured_media_wp_id', 'integer'),
        field('featured_image_url', 'text'),
        field('seo_title', 'string'),
        field('seo_description', 'text'),
        field('country', 'string'),
        field('region', 'string'),
        field('class_min', 'integer'),
        field('class_max', 'integer'),
        field('class_label', 'string'),
        field('put_in', 'text'),
        field('take_out', 'text'),
        field('length_km', 'float'),
        field('gradient', 'string'),
        field('season', 'string'),
        field('last_verified', 'date', { interface: 'datetime' }),
        field('lat', 'float'),
        field('lng', 'float'),
        field('legacy_categories', 'json', { interface: 'input-code', options: { language: 'json' } }),
        field('legacy_tags', 'json', { interface: 'input-code', options: { language: 'json' } }),
        field('tag_wp_ids', 'json', { interface: 'input-code', options: { language: 'json' } }),
        field('category_wp_ids', 'json', { interface: 'input-code', options: { language: 'json' } })
      ]
    },
    {
      collection: 'roc_pages',
      meta: { icon: 'description', display_template: '{{title}}' },
      schema: {},
      fields: [
        field('wp_id', 'integer', {}, { is_unique: true }),
        status,
        field('title', 'string', { required: true }),
        field('slug', 'string', { required: true }, { is_unique: true }),
        field('content', 'text', { interface: 'input-rich-text-html' }),
        field('page_template', 'string'),
        field('seo_title', 'string'),
        field('seo_description', 'text'),
        field('published_at', 'dateTime', { interface: 'datetime' }),
        field('updated_at', 'dateTime', { interface: 'datetime' }),
        field('author_wp_id', 'integer')
      ]
    },
    {
      collection: 'roc_redirects',
      meta: { icon: 'transfer_within_a_station', display_template: '{{url_from}}' },
      schema: {},
      fields: [
        field('url_from', 'string', { required: true }),
        field('url_to', 'string', { required: true }),
        field('type', 'string', {}, { default_value: '301' }),
        status
      ]
    },
    {
      collection: 'roc_site',
      meta: { icon: 'home', singleton: true },
      schema: {},
      fields: [
        field('title', 'string', {}, { default_value: 'Rivers of Chile' }),
        field('tagline', 'string'),
        field('nav', 'json', { interface: 'input-code', options: { language: 'json' } }),
        field('noindex', 'boolean', { interface: 'boolean' }, { default_value: true }),
        field('r2_public_base_url', 'string')
      ]
    }
  ].map((c) => ({ ...c, fields: [ID_FIELD, ...(c.fields || []).filter((f) => f.field !== 'id')] }));
}


async function ensureCollectionFields() {
  for (const col of collections()) {
    const existing = (await api('GET', `/fields/${col.collection}`)).data || [];
    const have = new Set(existing.map((f) => f.field));
    if (!have.has('id')) {
      await api('POST', `/fields/${col.collection}`, {
        field: 'id',
        type: 'integer',
        meta: { hidden: true, interface: 'numeric', readonly: true },
        schema: { is_primary_key: true, has_auto_increment: true }
      });
      have.add('id');
      console.log(`Added id field to ${col.collection}`);
    }
    for (const f of col.fields || []) {
      if (have.has(f.field)) continue;
      await api('POST', `/fields/${col.collection}`, f);
      have.add(f.field);
      console.log(`Added field ${col.collection}.${f.field}`);
    }
  }
}

async function ensureBuildRole() {
  const name = 'roc-build-readonly';
  const roles = (await api('GET', '/roles?limit=-1&fields=id,name')).data || [];
  let role = roles.find((r) => r.name === name);
  if (!role) {
    const created = await api('POST', '/roles', {
      name,
      icon: 'visibility',
      description: 'Read-only build access to published roc_* collections',
      admin_access: false,
      app_access: false
    });
    role = created.data;
    console.log('Created role roc-build-readonly');
  } else {
    console.log('Role roc-build-readonly already exists');
  }
  return role;
}

async function ensurePolicy(roleId) {
  const name = 'roc-build-published-read';
  const policies = (await api('GET', '/policies?limit=-1&fields=id,name')).data || [];
  let policy = policies.find((p) => p.name === name);
  if (!policy) {
    // Create the policy first without attaching a role. Attaching via
    // `roles` writes directus_access, which has thrown INTERNAL_SERVER_ERROR
    // in the admin UI on this instance.
    const created = await api('POST', '/policies', {
      name,
      description: 'Read published roc_* records for the static site build',
      app_access: false,
      admin_access: false
    });
    policy = created.data;
    console.log('Created policy roc-build-published-read');
  } else {
    console.log('Policy roc-build-published-read already exists');
  }

  try {
    await api('POST', '/access', { role: roleId, policy: policy.id });
    console.log('Linked policy to role via /access');
  } catch (err) {
    console.error(`Warning: could not link policy to role via /access: ${err.message}`);
    try {
      await api('PATCH', `/policies/${policy.id}`, { roles: [roleId] });
      console.log('Linked policy to role via PATCH /policies');
    } catch (err2) {
      console.error(`Warning: could not link policy to role via PATCH /policies: ${err2.message}`);
      console.error('Collections can still be imported with the admin token. The build user may lack read access until the policy is attached.');
    }
  }

  const existingPerms = (await api('GET', `/permissions?filter[policy][_eq]=${policy.id}&limit=-1`)).data || [];
  const have = new Set(existingPerms.map((p) => `${p.collection}:${p.action}`));
  const perms = [];
  for (const collection of COLLECTIONS) {
    if (!have.has(`${collection}:read`)) {
      const open = collection === 'roc_site' || collection === 'roc_regions' || collection === 'roc_media';
      perms.push({
        collection,
        action: 'read',
        policy: policy.id,
        fields: ['*'],
        permissions: open ? {} : { status: { _eq: 'published' } }
      });
    }
  }
  if (perms.length) {
    await api('POST', '/permissions', perms);
    console.log(`Created ${perms.length} read permissions`);
  } else {
    console.log('Read permissions already present');
  }
  return policy;
}

async function ensureBuildUser(roleId) {
  const email = 'roc-build@riversofchile.com';
  const users = (await api('GET', `/users?filter[email][_eq]=${encodeURIComponent(email)}&fields=id,email`)).data || [];
  const token = crypto.randomBytes(32).toString('hex');
  if (users.length) {
    await api('PATCH', `/users/${users[0].id}`, { role: roleId, token });
    console.log('Rotated existing roc build user token');
  } else {
    await api('POST', '/users', {
      email,
      first_name: 'ROC',
      last_name: 'Build',
      role: roleId,
      status: 'active',
      token
    });
    console.log('Created roc build user');
  }
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(TOKEN_FILE, 0o600);
  console.log(`Wrote DIRECTUS_BUILD_TOKEN to ${TOKEN_FILE}`);
  console.log('Store this value as a Cloudflare Pages encrypted build secret named DIRECTUS_BUILD_TOKEN. Do not commit the file or paste the token into chat.');
}

async function linkPolicyToRole(policyId, roleId, label) {
  try {
    await api('POST', '/access', { role: roleId, policy: policyId });
    console.log(`Linked ${label} policy to role via /access`);
    return true;
  } catch (err) {
    console.error(`Warning: could not link ${label} via /access: ${err.message}`);
    try {
      await api('PATCH', `/policies/${policyId}`, { roles: [roleId] });
      console.log(`Linked ${label} policy to role via PATCH /policies`);
      return true;
    } catch (err2) {
      console.error(`Warning: could not link ${label} via PATCH /policies: ${err2.message}`);
      return false;
    }
  }
}

async function ensureRiverFolder() {
  const name = 'River Sites';
  const existing = (await api('GET', `/folders?filter[name][_eq]=${encodeURIComponent(name)}&fields=id,name,parent`)).data || [];
  if (existing.length) {
    console.log('Folder "River Sites" already exists');
    return existing[0];
  }
  const created = await api('POST', '/folders', { name });
  console.log('Created Directus folder "River Sites" for editor file uploads');
  return created.data;
}

async function ensureEditorRoleAndPolicy() {
  const roleName = 'River Sites Editor';
  const policyName = 'River Sites Editor';
  const roles = (await api('GET', '/roles?limit=-1&fields=id,name')).data || [];
  let role = roles.find((r) => r.name === roleName);
  if (!role) {
    const created = await api('POST', '/roles', {
      name: roleName,
      icon: 'edit',
      description: 'App access and full CRUD on river-guide collections (roc_* now; peru_* can be added later). No access to vpnreviewz_*.',
      admin_access: false,
      app_access: true
    });
    role = created.data;
    console.log('Created role "River Sites Editor"');
  } else {
    console.log('Role "River Sites Editor" already exists');
  }

  const policies = (await api('GET', '/policies?limit=-1&fields=id,name')).data || [];
  let policy = policies.find((p) => p.name === policyName);
  if (!policy) {
    const created = await api('POST', '/policies', {
      name: policyName,
      description: 'App access and CRUD on river-guide collections (roc_* now; add peru_* later). Never grant vpnreviewz_*.',
      app_access: true,
      admin_access: false
    });
    policy = created.data;
    console.log('Created policy "River Sites Editor"');
  } else {
    console.log('Policy "River Sites Editor" already exists');
  }

  const linked = await linkPolicyToRole(policy.id, role.id, 'River Sites Editor');
  if (!linked) {
    console.error('Editor role may not see collections until the policy is attached in the Directus admin.');
  }

  const folder = await ensureRiverFolder();
  const folderId = folder?.id;
  const existingPerms = (await api('GET', `/permissions?filter[policy][_eq]=${policy.id}&limit=-1`)).data || [];
  const have = new Set(existingPerms.map((p) => `${p.collection}:${p.action}`));
  const actions = ['create', 'read', 'update', 'delete'];
  const perms = [];
  for (const collection of COLLECTIONS) {
    for (const action of actions) {
      if (!have.has(`${collection}:${action}`)) {
        perms.push({
          collection,
          action,
          policy: policy.id,
          fields: ['*'],
          permissions: {},
          validation: {},
          presets: null
        });
      }
    }
  }

  // File library: prefer scoping uploads to the "River Sites" folder.
  // Create is unfiltered (Directus often cannot filter folder on create);
  // a preset places new files in that folder. Read/update/delete are folder-scoped.
  const folderFilter = folderId ? { folder: { _eq: folderId } } : {};
  const folderOrRoot = folderId
    ? { _or: [{ id: { _eq: folderId } }, { parent: { _eq: folderId } }] }
    : {};
  for (const action of actions) {
    if (!have.has(`directus_files:${action}`)) {
      perms.push({
        collection: 'directus_files',
        action,
        policy: policy.id,
        fields: ['*'],
        permissions: action === 'create' ? {} : folderFilter,
        validation: {},
        presets: action === 'create' && folderId ? { folder: folderId } : null
      });
    }
    if (!have.has(`directus_folders:${action}`)) {
      const folderPerms = action === 'create' ? {} : (action === 'read' ? folderOrRoot : { id: { _eq: folderId } });
      perms.push({
        collection: 'directus_folders',
        action: action === 'delete' ? 'read' : action, // do not grant folder delete; read already added
        policy: policy.id,
        fields: ['*'],
        permissions: action === 'delete' ? { id: { _eq: '__skip_delete__' } } : folderPerms,
        validation: {},
        presets: action === 'create' && folderId ? { parent: folderId } : null
      });
    }
  }

  // Dedupe folder delete skip — grant only create/read/update on folders, not delete.
  const cleaned = perms.filter((p) => !(p.collection === 'directus_folders' && p.permissions && p.permissions.id && p.permissions.id._eq === '__skip_delete__'));
  const seen = new Set();
  const unique = [];
  for (const perm of cleaned) {
    const key = `${perm.collection}:${perm.action}`;
    if (seen.has(key) || have.has(key)) continue;
    seen.add(key);
    unique.push(perm);
  }

  if (unique.length) {
    await api('POST', '/permissions', unique);
    console.log(`Created ${unique.length} River Sites Editor permissions (roc_* CRUD + scoped files/folders)`);
  } else {
    console.log('River Sites Editor permissions already present');
  }

  console.log('Friend user was not created (email not provided). Assign them the "River Sites Editor" role later.');
  return { role, policy, folderId };
}

async function main() {
  requireAdminToken();
  const existing = (await api('GET', '/collections?limit=-1')).data || [];
  const have = new Set(existing.map((c) => c.collection));
  for (const col of collections()) {
    if (have.has(col.collection)) {
      console.log(`Collection ${col.collection} already exists; skipping`);
      continue;
    }
    if (col.collection.startsWith('vpnreviewz_')) {
      throw new Error('Refusing to create a vpnreviewz_* collection');
    }
    await api('POST', '/collections', col);
    console.log(`Created collection ${col.collection}`);
  }
  await ensureCollectionFields();
  const role = await ensureBuildRole();
  await ensurePolicy(role.id);
  await ensureBuildUser(role.id);
  await ensureEditorRoleAndPolicy();
  console.log('Directus setup complete.');
  console.log('Roles/policies: roc-build-readonly (build), River Sites Editor (friend, app+CRUD on roc_*; peru_* later).');
}

main().catch((err) => {
  console.error(err.message || 'Directus setup failed');
  process.exit(1);
});
