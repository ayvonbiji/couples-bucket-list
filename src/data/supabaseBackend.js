// Supabase implementation of the backend interface (see backend.js for the contract).
import { createClient } from '@supabase/supabase-js';
import { DATA_TABLES } from './tables.js';

export function createSupabaseBackend(url, anonKey) {
  const sb = createClient(url, anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  const urlCache = new Map(); // storage path → { url, exp }

  /** Throw a readable Error if Supabase returned one. */
  const check = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  const applyMatch = (q, match) => Object.entries(match).reduce((qq, [k, v]) => qq.eq(k, v), q);

  return {
    mode: 'supabase',
    client: sb,

    // ---------------- auth ----------------
    async getUser() {
      const { data } = await sb.auth.getSession();
      return data.session?.user ?? null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null));
      return () => data.subscription.unsubscribe();
    },
    async signInWithEmail(email) {
      check(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }));
    },
    async signOut() {
      await sb.auth.signOut();
    },

    // ---------------- workspace ----------------
    async getMembership(userId) {
      const m = check(await sb.from('workspace_members').select('workspace_id').eq('user_id', userId).maybeSingle());
      if (!m) return null;
      const workspace = check(await sb.from('workspaces').select('*').eq('id', m.workspace_id).single());
      const memberRows = check(await sb.from('workspace_members').select('user_id').eq('workspace_id', workspace.id));
      const ids = memberRows.map((r) => r.user_id);
      const members = check(await sb.from('users').select('*').in('id', ids));
      return { workspace, members };
    },
    async createWorkspace(name, currency) {
      return check(await sb.rpc('create_workspace', { p_name: name, p_currency: currency }));
    },
    async joinWorkspace(code) {
      return check(await sb.rpc('join_workspace', { p_code: code }));
    },
    async updateWorkspace(id, patch) {
      return check(await sb.from('workspaces').update(patch).eq('id', id).select().single());
    },
    async updateProfile(id, patch) {
      return check(await sb.from('users').update(patch).eq('id', id).select().single());
    },

    // ---------------- data ----------------
    /** Load everything for the workspace. RLS already applies the privacy rules. */
    async loadAll(wsId) {
      const results = await Promise.all(DATA_TABLES.map((t) => sb.from(t).select('*').eq('workspace_id', wsId)));
      return Object.fromEntries(DATA_TABLES.map((t, i) => [t, check(results[i]) || []]));
    },
    async insert(table, row) {
      return check(await sb.from(table).insert(row).select().single());
    },
    async insertMany(table, rows) {
      if (!rows.length) return [];
      return check(await sb.from(table).insert(rows).select());
    },
    async upsert(table, row, onConflict) {
      return check(await sb.from(table).upsert(row, { onConflict }).select().single());
    },
    async update(table, match, patch) {
      return check(await applyMatch(sb.from(table).update(patch), match).select().maybeSingle());
    },
    async remove(table, match) {
      check(await applyMatch(sb.from(table).delete(), match));
    },
    /** Bulk insert for restores (keeps original authors; validated server-side). */
    async importRows(table, rows) {
      if (rows.length) check(await sb.rpc('import_rows', { p_table: table, p_rows: rows }));
    },
    async dashboardSummary(wsId) {
      return check(await sb.rpc('dashboard_summary', { p_ws: wsId }));
    },
    async sharedList(token) {
      return check(await sb.rpc('get_shared_list', { p_token: token }));
    },

    // ---------------- storage ----------------
    async uploadFile(bucket, path, blob) {
      check(await sb.storage.from(bucket).upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: true }));
      return path;
    },
    /** Signed URL (buckets are private), cached for ~50 minutes. */
    async fileUrl(bucket, path) {
      const key = `${bucket}/${path}`;
      const hit = urlCache.get(key);
      if (hit && hit.exp > Date.now()) return hit.url;
      const data = check(await sb.storage.from(bucket).createSignedUrl(path, 3600));
      urlCache.set(key, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
      return data.signedUrl;
    },
    async downloadFile(bucket, path) {
      return check(await sb.storage.from(bucket).download(path));
    },
    async removeFiles(bucket, paths) {
      if (paths.length) check(await sb.storage.from(bucket).remove(paths));
    },

    // ---------------- realtime ----------------
    /** Calls `onChange` whenever the partner changes something. Debounced by the caller. */
    subscribe(wsId, onChange) {
      const ch = sb.channel(`ws-${wsId}`);
      for (const t of DATA_TABLES.filter((t) => t !== 'backups')) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `workspace_id=eq.${wsId}` }, onChange);
      }
      ch.subscribe();
      return () => sb.removeChannel(ch);
    },

    // ---------------- Google Calendar (read-only) ----------------
    /** Fetch an iCal feed through the `ical-proxy` Edge Function (avoids browser CORS). */
    async fetchIcal(icalUrl) {
      const { data, error } = await sb.functions.invoke('ical-proxy', { body: { url: icalUrl } });
      if (error) throw new Error('Could not reach the calendar feed. Is the ical-proxy function deployed?');
      return typeof data === 'string' ? data : data?.ics ?? '';
    },
  };
}
