#!/usr/bin/env node
// Create (or update) the two login accounts in Supabase Auth and link them to one shared list.
//
//   SUPABASE_SERVICE_ROLE_KEY=... npm run setup-accounts
//
// - Uses the service-role key, which must stay on YOUR computer: never put it in .env.local
//   (Vite would expose VITE_* variables to the browser) and never commit it.
// - Passwords are typed at a hidden prompt and sent straight to Supabase Auth, which stores
//   only a bcrypt hash. Nothing is written to disk or printed.
// - Safe to re-run: existing accounts get their password/name updated instead of duplicates.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import readline from 'node:readline';
import { USERNAME_DOMAIN, normalizeUsername, usernameToEmail, validatePassword, validateUsername } from '../src/lib/auth.js';

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
// Hidden input for passwords.
function askHidden(q) {
  return new Promise((res) => {
    const write = rl._writeToOutput;
    rl._writeToOutput = (s) => (s.includes(q) ? write.call(rl, s) : write.call(rl, ''));
    rl.question(q, (a) => { rl._writeToOutput = write; process.stdout.write('\n'); res(a); });
  });
}

async function promptAccount(n) {
  console.log(`\nAccount ${n}`);
  let username;
  for (;;) { username = normalizeUsername(await ask('  Username: ')); const e = validateUsername(username); if (!e) break; console.log(`  ${e}`); }
  const display = (await ask(`  Display name [${username}]: `)) || username;
  let password;
  for (;;) {
    password = await askHidden('  Password: ');
    const e = validatePassword(password, { strict: true });
    if (e) { console.log(`  ${e}`); continue; }
    if ((await askHidden('  Repeat password: ')) !== password) { console.log('  Passwords did not match'); continue; }
    break;
  }
  return { username, display, password };
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
  console.log(`Our Bucket List — account setup\nSupabase: ${url}\nUsernames sign in as <username>@${USERNAME_DOMAIN} behind the scenes.`);
  const listName = (await ask('\nName of your shared list [Our Bucket List]: ')) || 'Our Bucket List';
  const a = await promptAccount(1);
  const b = await promptAccount(2);
  if (a.username === b.username) throw new Error('Use two different usernames');
  console.log('\nSaving…');
  const ua = await upsertAccount(a);
  const ub = await upsertAccount(b);
  await linkWorkspace(ua, ub, listName);
  console.log('\nDone. You can both sign in with your usernames and passwords.');
} catch (e) {
  console.error(`\nSetup failed: ${e.message || e}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
