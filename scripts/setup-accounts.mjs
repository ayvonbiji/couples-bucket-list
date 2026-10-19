#!/usr/bin/env node
// Create (or update) the two accounts in Supabase Auth, link them to one shared list,
// and print each partner's PERSONAL LINK. There is no login screen: opening the link once
// on a phone signs that phone in, and the app then always opens straight to Home.
//
//   SUPABASE_SERVICE_ROLE_KEY=... npm run setup-accounts
//
// - Uses the service-role key, which must stay on YOUR computer: never put it in .env.local
//   (Vite would expose VITE_* variables to the browser) and never commit it.
// - Each link carries a fresh random 256-bit secret. Supabase Auth stores only its bcrypt hash;
//   nothing is written to disk. Treat each link like a password and send it only to its owner.
// - Safe to re-run: existing accounts are updated instead of duplicated, and re-running
//   replaces both links (old links stop working — use this if a phone is lost).
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import readline from 'node:readline';
import { randomBytes } from 'node:crypto';
import { USERNAME_DOMAIN, normalizeUsername, usernameToEmail, validateUsername } from '../src/lib/auth.js';

// Read SUPABASE_URL from the environment or .env.local (VITE_SUPABASE_URL).
function envFile() {
  const out = {};
  for (const f of ['.env.local', '.env']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return out;
}
const fileEnv = envFile();
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL in .env.local) and SUPABASE_SERVICE_ROLE_KEY in your shell, then run again.');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));
async function promptAccount(n) {
  console.log(`\nAccount ${n}`);
  let username;
  for (;;) { username = normalizeUsername(await ask('  Username: ')); const e = validateUsername(username); if (!e) break; console.log(`  ${e}`); }
  const display = (await ask(`  Display name [${username}]: `)) || username;
  return { username, display, password: randomBytes(32).toString('base64url') };
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function upsertAccount({ username, display, password }) {
  const email = usernameToEmail(username);
  const meta = { username, display_name: display };
  const existing = await findUserByEmail(email);
  let user;
  if (existing) {
    const { data, error } = await sb.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: meta });
    if (error) throw error;
    user = data.user;
    console.log(`  ✓ updated ${username}`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
    if (error) throw error;
    user = data.user;
    console.log(`  ✓ created ${username}`);
  }
  const { error } = await sb.from('users').upsert({ id: user.id, email, username, display_name: display }, { onConflict: 'id' });
  if (error) throw error;
  return user;
}

async function linkWorkspace(a, b, listName) {
  const { data: rows, error } = await sb.from('workspace_members').select('workspace_id, user_id').in('user_id', [a.id, b.id]);
  if (error) throw error;
  const wa = rows.find((r) => r.user_id === a.id)?.workspace_id;
  const wb = rows.find((r) => r.user_id === b.id)?.workspace_id;
  if (wa && wb && wa !== wb) throw new Error('These two accounts already belong to different lists. Remove one membership in Supabase first.');
  let ws = wa || wb;
  if (!ws) {
    const { data, error: e } = await sb.from('workspaces').insert({ name: listName, created_by: a.id }).select().single();
    if (e) throw e;
    ws = data.id;
    console.log(`  ✓ created shared list “${listName}”`);
  }
  for (const u of [a, b]) {
    if (rows.some((r) => r.user_id === u.id)) continue;
    const { error: e } = await sb.from('workspace_members').insert({ workspace_id: ws, user_id: u.id });
    if (e) throw e;
  }
  console.log('  ✓ both accounts share one list');
}

try {
  console.log(`Our Bucket List — account setup\nSupabase: ${url}\nAccounts are stored as <username>@${USERNAME_DOMAIN} behind the scenes.`);
  let appUrl = process.env.APP_URL || (await ask('\nAddress of your app (e.g. https://our-bucket-list.vercel.app): '));
  appUrl = appUrl.replace(/\/+$/, '');
  if (!/^https?:\/\//.test(appUrl)) throw new Error('Enter the full address, starting with https://');
  const listName = (await ask('\nName of your shared list [Our Bucket List]: ')) || 'Our Bucket List';
  const a = await promptAccount(1);
  const b = await promptAccount(2);
  if (a.username === b.username) throw new Error('Use two different usernames');
  console.log('\nSaving…');
  const ua = await upsertAccount(a);
  const ub = await upsertAccount(b);
  await linkWorkspace(ua, ub, listName);
  console.log('\nDone. Personal links — open each one once on its owner\'s phone, then just open the app:');
  console.log(`\n  ${a.display}: ${appUrl}/#key=${a.username}.${a.password}`);
  console.log(`  ${b.display}: ${appUrl}/#key=${b.username}.${b.password}`);
  console.log('\nKeep these private: anyone with a link can open the app as that person.');
} catch (e) {
  console.error(`\nSetup failed: ${e.message || e}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
