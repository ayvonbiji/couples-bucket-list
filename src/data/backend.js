// Picks the data backend.
//  * VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set → Supabase (real two-person sync)
//  * otherwise → Demo Mode (localStorage + IndexedDB in this browser)
//
// Both expose the same interface: auth, workspace, generic table CRUD
// (insert/update/upsert/remove/loadAll), file storage, realtime subscribe.
import { createLocalBackend } from './localBackend.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

let backendPromise;
export function getBackend() {
  backendPromise ||= isSupabaseConfigured
    ? import('./supabaseBackend.js').then((m) => m.createSupabaseBackend(url, key))
    : Promise.resolve(createLocalBackend());
  return backendPromise;
}
